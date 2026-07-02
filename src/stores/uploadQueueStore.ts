// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  type: "audio" | "video";
  size: number;
  status: "pending" | "decoding" | "transcribing" | "completed" | "failed" | "cancelled";
  progressPercent: number;
  segmentInfo: string;
  outputText: string;
  error?: string;
  durationMs?: number;
}

interface UploadQueueStore {
  queue: QueueItem[];
  selectedItemId: string | null;
  isProcessing: boolean;
  selectedTemplateId: string;
  splitInterval: number;
  copiedId: string | null;

  addToQueue: (items: QueueItem[]) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  setSelectedItemId: (id: string | null) => void;
  setIsProcessing: (val: boolean) => void;
  setSelectedTemplateId: (id: string) => void;
  setSplitInterval: (val: number) => void;
  setCopiedId: (id: string | null) => void;
  updateItemText: (id: string, text: string, append?: boolean) => void;
  updateItemStatus: (id: string, updates: Partial<Omit<QueueItem, "id" | "file">>) => void;
}

export const useUploadQueueStore = create<UploadQueueStore>((set) => ({
  queue: [],
  selectedItemId: null,
  isProcessing: false,
  selectedTemplateId: "",
  splitInterval: 10,
  copiedId: null,

  addToQueue: (items) =>
    set((state) => {
      const nextQueue = [...state.queue, ...items];
      return {
        queue: nextQueue,
        selectedItemId: state.selectedItemId || items[0]?.id || null,
      };
    }),

  removeFromQueue: (id) =>
    set((state) => {
      const nextQueue = state.queue.filter((item) => item.id !== id);
      const nextSelected = state.selectedItemId === id
        ? (nextQueue[0]?.id || null)
        : state.selectedItemId;
      return {
        queue: nextQueue,
        selectedItemId: nextSelected,
      };
    }),

  clearQueue: () =>
    set((state) => {
      if (state.isProcessing) return {};
      return { queue: [], selectedItemId: null };
    }),

  setSelectedItemId: (id) => set({ selectedItemId: id }),
  setIsProcessing: (val) => set({ isProcessing: val }),
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
  setSplitInterval: (val) => set({ splitInterval: val }),
  setCopiedId: (id) => set({ copiedId: id }),

  updateItemText: (id, text, append = true) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id
          ? { ...item, outputText: append ? item.outputText + text : text }
          : item
      ),
    })),

  updateItemStatus: (id, updates) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
}));
