// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";
import type { RecordingResult } from "../lib/audio";

type RecordingState = "idle" | "recording" | "processing" | "done" | "error";

interface RecordingStore {
  state: RecordingState;
  paused: boolean;
  duration: number;
  totalDurationMs: number | null;
  waveformBars: number[];
  output: string;
  lastResult: RecordingResult | null;
  error: string | null;
  activeModel: string | null;

  setState: (s: RecordingState) => void;
  setPaused: (p: boolean) => void;
  setDuration: (ms: number) => void;
  setTotalDurationMs: (ms: number) => void;
  setWaveform: (bars: number[]) => void;
  appendOutput: (text: string) => void;
  setOutput: (text: string) => void;
  setLastResult: (r: RecordingResult) => void;
  setError: (e: string | null) => void;
  setActiveModel: (m: string | null) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  state: "idle",
  paused: false,
  duration: 0,
  totalDurationMs: null,
  waveformBars: [20, 40, 60, 40, 80, 60, 40, 20],
  output: "",
  lastResult: null,
  error: null,
  activeModel: null,

  setState: (s) => set({ state: s }),
  setPaused: (p) => set({ paused: p }),
  setDuration: (ms) => set({ duration: ms }),
  setTotalDurationMs: (ms) => set({ totalDurationMs: ms }),
  setWaveform: (bars) => set({ waveformBars: bars }),
  appendOutput: (text) => set((s) => ({ output: s.output + text })),
  setOutput: (text) => set({ output: text }),
  setLastResult: (r) => set({ lastResult: r }),
  setError: (e) => set({ error: e }),
  setActiveModel: (m) => set({ activeModel: m }),
  reset: () => set({ state: "idle", paused: false, duration: 0, totalDurationMs: null, output: "", error: null, activeModel: null }),
}));
