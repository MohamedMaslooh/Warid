// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";
import { loadSettings, saveSettings } from "../lib/store";
import { DEFAULT_SETTINGS, type Settings } from "../types";

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await loadSettings();
    set({ settings, loaded: true });
  },

  update: async (partial) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    await saveSettings(partial);
  },
}));
