// SPDX-License-Identifier: AGPL-3.0-or-later

export interface RecordingResult {
  base64: string;
  mimeType: string;
  durationMs: number;
  blob: Blob;
}

export class RecordingStartCancelledError extends Error {
  constructor() {
    super("Recording start cancelled");
    this.name = "RecordingStartCancelledError";
  }
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioCtx: AudioContext | null = null;
  private animFrameId: number | null = null;
  private pausedAt: number | null = null;
  private accumulatedPauseMs = 0;
  private startGeneration = 0;
  private pendingStart: Promise<void> | null = null;

  onWaveform: ((bars: number[]) => void) | null = null;
  onDuration: ((ms: number) => void) | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;

  private elapsed(): number {
    const now = this.pausedAt ?? Date.now();
    return now - this.startTime - this.accumulatedPauseMs;
  }

  async start(deviceId?: string): Promise<void> {
    if (this.isRecording) return;
    if (this.pendingStart) return this.pendingStart;
    this.cleanup();
    const generation = ++this.startGeneration;
    // macOS only: WebKit's voice processing (EC/NS/AGC) ducks and muffles the
    // mic. Other platforms keep the browser defaults exactly as before.
    const isMac = navigator.userAgent.includes("Macintosh");
    const audioConstraint: MediaTrackConstraints | boolean = isMac
      ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        }
      : deviceId
        ? { deviceId: { exact: deviceId } }
        : true;
    const pending = (async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
        if (generation !== this.startGeneration) throw new RecordingStartCancelledError();
        this.stream = stream;
        this.audioCtx = new AudioContext();
        const source = this.audioCtx.createMediaStreamSource(stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        this.mediaRecorder = new MediaRecorder(stream, { mimeType });
        this.chunks = [];
        this.startTime = Date.now();
        this.pausedAt = null;
        this.accumulatedPauseMs = 0;

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.chunks.push(e.data);
        };

        this.mediaRecorder.start(100);
        this.tickWaveform();

        this.durationInterval = setInterval(() => {
          this.onDuration?.(this.elapsed());
        }, 200);
      } catch (err) {
        // A cancelled request owns its stream, not any newer recording's state.
        if (generation === this.startGeneration) this.cleanup();
        else stream?.getTracks().forEach((track) => track.stop());
        if (generation !== this.startGeneration) throw new RecordingStartCancelledError();
        throw err;
      }
    })();
    this.pendingStart = pending;
    try {
      await pending;
    } finally {
      if (this.pendingStart === pending) this.pendingStart = null;
    }
  }

  pause(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.pause();
      this.pausedAt = Date.now();
    }
  }

  resume(): void {
    if (this.mediaRecorder?.state === "paused") {
      if (this.pausedAt !== null) {
        this.accumulatedPauseMs += Date.now() - this.pausedAt;
        this.pausedAt = null;
      }
      this.mediaRecorder.resume();
    }
  }

  get isPaused(): boolean {
    return this.mediaRecorder?.state === "paused";
  }

  stop(): Promise<RecordingResult> {
    if (this.pendingStart && !this.isRecording && !this.isPaused) {
      // Stopping before permission resolves means cancel, not an empty recording.
      this.cancel();
      return Promise.reject(new RecordingStartCancelledError());
    }
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("Not recording"));
        return;
      }

      if (this.pausedAt !== null) {
        this.accumulatedPauseMs += Date.now() - this.pausedAt;
        this.pausedAt = null;
      }
      const durationMs = this.elapsed();

      this.mediaRecorder.onstop = async () => {
        try {
          const mimeType = this.mediaRecorder!.mimeType;
          const blob = new Blob(this.chunks, { type: mimeType });
          const base64 = await blobToBase64(blob);
          this.cleanup();
          resolve({ base64, mimeType, durationMs, blob });
        } catch (err) {
          // Bubble failures up instead of leaving the promise hanging forever
          // (this is what used to silently break long recordings).
          this.cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      this.mediaRecorder.stop();
    });
  }

  cancel(): void {
    ++this.startGeneration;
    this.pendingStart = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.durationInterval) clearInterval(this.durationInterval);
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.audioCtx) void this.audioCtx.close().catch(() => {});
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.onerror = null;
    }
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.animFrameId = null;
    this.durationInterval = null;
    this.pausedAt = null;
    this.accumulatedPauseMs = 0;
  }

  private tickWaveform() {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const draw = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      const bars = Array.from({ length: 8 }, (_, i) => {
        const idx = Math.floor((i / 8) * data.length);
        return Math.max(4, (data[idx] / 255) * 100);
      });
      this.onWaveform?.(bars);
      this.animFrameId = requestAnimationFrame(draw);
    };
    draw();
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }
}

export function playBeep(type: "start" | "stop" | "done" | "cancel") {
  const ctx = new AudioContext();

  if (type === "cancel") {
    // Two quick descending notes — distinct from the single-sweep stop beep.
    const t0 = ctx.currentTime;
    const playNote = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startAt);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.18, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.1);
      osc.start(startAt);
      osc.stop(startAt + 0.11);
    };
    playNote(520, t0);
    playNote(320, t0 + 0.1);
    setTimeout(() => ctx.close(), 350);
    return;
  }

  if (type === "done") {
    // Two-note ascending chime — clearly distinct from start/stop beeps.
    const t0 = ctx.currentTime;
    const noteDur = 0.14;
    const playNote = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startAt);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + noteDur);
      osc.start(startAt);
      osc.stop(startAt + noteDur + 0.02);
    };
    playNote(880, t0);            // A5
    playNote(1318.5, t0 + 0.12);  // E6
    setTimeout(() => ctx.close(), 400);
    return;
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (type === "start") {
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.08);
  } else {
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.08);
  }
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
  osc.onended = () => ctx.close();
}

/**
 * Convert a Blob to base64 safely for arbitrary sizes.
 *
 * The naive `btoa(String.fromCharCode(...new Uint8Array(buf)))` pattern
 * blows the engine's argument-spread limit (~100k–250k args) and throws
 * `RangeError: Maximum call stack size exceeded` for anything past a few
 * hundred KB. FileReader.readAsDataURL handles the encoding natively in
 * C++ with no size limit, so we strip the `data:...;base64,` prefix and
 * return the raw payload.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader: expected string result"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
