// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";

export type LogLevel = "info" | "warn" | "error" | "success";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  msg: string;
  detail?: string;
}

interface LogStore {
  entries: LogEntry[];
  addLog: (level: LogLevel, msg: string, detail?: string) => void;
  clear: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  entries: [],

  addLog: (level, msg, detail) =>
    set((s) => ({
      entries: [
        ...s.entries,
        { id: crypto.randomUUID(), ts: Date.now(), level, msg, detail },
      ].slice(-500), // keep last 500 entries
    })),

  clear: () => set({ entries: [] }),
}));
