// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";
import { getTemplates, upsertTemplate, deleteTemplate } from "../lib/db";
import { syncCommandHotkeys } from "../lib/commandHotkeys";
import type { Template } from "../types";
import { DEFAULT_TEMPLATES } from "../types";


interface TemplatesStore {
  templates: Template[];
  activeTemplateId: string;
  load: (preferredId?: string) => Promise<void>;
  setActive: (id: string) => void;
  save: (t: Template) => Promise<void>;
  remove: (id: string) => Promise<void>;
  active: () => Template | undefined;
}

export const useTemplatesStore = create<TemplatesStore>((set, get) => ({
  templates: [],
  activeTemplateId: "",

  load: async (preferredId) => {
    const raw = await getTemplates();
    // Merge name_en from DEFAULT_TEMPLATES for built-in entries (no DB column needed).
    // Only inject when the DB name still equals the original default — otherwise the
    // user has renamed the built-in and we must respect their custom name in both langs.
    const templates = raw.map((tpl) => {
      const def = DEFAULT_TEMPLATES.find((d) => d.id === tpl.id);
      return def?.name_en && tpl.name === def.name ? { ...tpl, name_en: def.name_en } : tpl;
    });
    const current = get().activeTemplateId;
    const nextActiveId =
      [current, preferredId, templates[0]?.id].find((id) => id && templates.some((t) => t.id === id)) || "";
    set({ templates, activeTemplateId: nextActiveId });
    void syncCommandHotkeys(templates);
  },

  setActive: (id) => set({ activeTemplateId: id }),

  save: async (t) => {
    await upsertTemplate(t);
    await get().load();
  },

  remove: async (id) => {
    await deleteTemplate(id);
    const templates = await getTemplates();
    set({ templates });
    void syncCommandHotkeys(templates);
  },

  active: () => {
    const { templates, activeTemplateId } = get();
    return templates.find((t) => t.id === activeTemplateId);
  },
}));
