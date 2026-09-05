// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";

interface QuotaState {
  // Key: YYYY-MM-DD
  usage: Record<string, Record<string, number>>;
  // modelId -> epoch ms until which the model is deprioritized (high demand).
  cooldowns: Record<string, number>;
  // modelId -> epoch ms of each request in the last minute. Memory-only: the
  // window is 60s, so nothing is lost that would still be relevant at restart.
  recent: Record<string, number[]>;
  incrementRequest: (modelId: string) => void;
  getRequestCountToday: (modelId: string) => number;
  /** Requests sent to this model in the last 60s — checked against its RPM cap
   *  so Auto steps aside before Google answers with a 429. */
  getRequestCountLastMinute: (modelId: string) => number;
  /** Mark a model as overloaded; Auto skips it until the cooldown expires. */
  markHighDemand: (modelId: string, durationMs: number) => void;
  isCoolingDown: (modelId: string) => boolean;
}

/** Width of the per-minute rate-limit window. */
const MINUTE_MS = 60 * 1000;

const STORAGE_KEY = "warid-request-quota-v1";
const COOLDOWN_KEY = "warid-model-cooldown-v1";

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const loadInitialUsage = (): Record<string, Record<string, number>> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Basic validation: clear old entries to prevent localStorage bloat, keeping only the last 7 days
    const today = getTodayString();
    const cleaned: Record<string, Record<string, number>> = {};
    for (const key of Object.keys(parsed)) {
      const diffTime = Math.abs(new Date(today).getTime() - new Date(key).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        cleaned[key] = parsed[key];
      }
    }
    return cleaned;
  } catch {
    return {};
  }
};

const loadInitialCooldowns = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    // Drop already-expired entries so the map doesn't grow unbounded.
    for (const [id, until] of Object.entries(parsed)) {
      if (typeof until === "number" && until > now) cleaned[id] = until;
    }
    return cleaned;
  } catch {
    return {};
  }
};

export const useRequestTrackerStore = create<QuotaState>((set, get) => ({
  usage: loadInitialUsage(),
  cooldowns: loadInitialCooldowns(),
  recent: {},

  incrementRequest: (modelId: string) => {
    const today = getTodayString();
    const now = Date.now();
    set((state) => {
      const dayUsage = state.usage[today] ? { ...state.usage[today] } : {};
      dayUsage[modelId] = (dayUsage[modelId] ?? 0) + 1;
      const updatedUsage = { ...state.usage, [today]: dayUsage };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUsage));
      // Slide the per-minute window forward, dropping anything older than 60s.
      const window = [...(state.recent[modelId] ?? []), now].filter((ts) => now - ts < MINUTE_MS);
      return { usage: updatedUsage, recent: { ...state.recent, [modelId]: window } };
    });
  },

  getRequestCountToday: (modelId: string) => {
    const today = getTodayString();
    return get().usage[today]?.[modelId] ?? 0;
  },

  getRequestCountLastMinute: (modelId: string) => {
    const now = Date.now();
    return (get().recent[modelId] ?? []).filter((ts) => now - ts < MINUTE_MS).length;
  },

  markHighDemand: (modelId: string, durationMs: number) => {
    set((state) => {
      const now = Date.now();
      // Carry forward only still-active cooldowns, then add/extend this one.
      const next: Record<string, number> = {};
      for (const [id, until] of Object.entries(state.cooldowns)) {
        if (until > now) next[id] = until;
      }
      next[modelId] = now + durationMs;
      localStorage.setItem(COOLDOWN_KEY, JSON.stringify(next));
      return { cooldowns: next };
    });
  },

  isCoolingDown: (modelId: string) => (get().cooldowns[modelId] ?? 0) > Date.now(),
}));
