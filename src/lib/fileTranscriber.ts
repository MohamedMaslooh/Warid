// SPDX-License-Identifier: AGPL-3.0-or-later

const TARGET_SAMPLE_RATE = 16000;

/**
 * Decodes the audio track of any audio or video file into an AudioBuffer.
 * Browser's native decoding natively extracts audio tracks from video containers like MP4, WebM.
 */
export async function decodeAudioFromFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  // Using standard AudioContext
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }
}

/**
 * Downsamples an AudioBuffer to 16kHz Mono using OfflineAudioContext.
 */
export async function downsampleToMono16kHz(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
  const duration = audioBuffer.duration;
  const length = Math.round(TARGET_SAMPLE_RATE * duration);
  
  const offlineCtx = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE);
  
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * Encodes a Float32Array of 16kHz audio samples into a standard 16-bit PCM WAV Blob.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM = 1) */
  view.setUint16(20, 1, true);
  /* channel count (mono = 1) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample = 2) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

/**
 * Splits a downsampled AudioBuffer into segments and converts them to base64 WAV chunks.
 * returns list of { index, blob, durationSec }
 */
export function segmentAudioBuffer(
  audioBuffer: AudioBuffer,
  segmentDurationSec: number
): { index: number; blob: Blob; start: number; end: number }[] {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  
  const segments: { index: number; blob: Blob; start: number; end: number }[] = [];
  const segmentLengthSamples = segmentDurationSec * sampleRate;
  
  let index = 0;
  for (let startSample = 0; startSample < channelData.length; startSample += segmentLengthSamples) {
    const endSample = Math.min(startSample + segmentLengthSamples, channelData.length);
    
    // Extract slice
    const segmentSamples = channelData.subarray(startSample, endSample);
    const blob = encodeWav(segmentSamples, sampleRate);
    
    segments.push({
      index,
      blob,
      start: startSample / sampleRate,
      end: endSample / sampleRate
    });
    index++;
  }
  
  return segments;
}

/**
 * Converts a Blob to a Base64 string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
