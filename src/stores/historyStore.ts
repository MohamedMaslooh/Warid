// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";
import { getHistory, deleteHistoryItem, clearHistory } from "../lib/db";
import type { HistoryItem } from "../types";

interface HistoryStore {
  items: HistoryItem[];
  search: string;
  load: (search?: string) => Promise<void>;
  setSearch: (s: string) => void;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  items: [],
  search: "",

  load: async (search) => {
    const q = search ?? get().search;
    const items = await getHistory(100, 0, q);
    set({ items, search: q });
  },

  setSearch: (s) => {
    set({ search: s });
    get().load(s);
  },

  remove: async (id) => {
    await deleteHistoryItem(id);
    await get().load();
  },

  clear: async () => {
    await clearHistory();
    set({ items: [] });
  },
}));
