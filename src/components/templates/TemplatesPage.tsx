// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X, Star } from "lucide-react";
import { HotkeyField } from "../ui/HotkeyField";
import { useTemplatesStore } from "../../stores/templatesStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { KNOWN_MODELS, AUTO_MODEL_ID } from "../../lib/gemini";
import { Select } from "../ui/Select";
import { formatAccelerator, normalizeAccelerator } from "../../lib/hotkey";
import { useLang } from "../../lib/useLang";
import type { Template } from "../../types";

function getTemplateName(tpl: { name: string; name_en?: string }, lang: string): string {
  return lang === "en" && tpl.name_en ? tpl.name_en : tpl.name;
}


const EMPTY_TEMPLATE = (): Template => ({
  id: crypto.randomUUID(),
  name: "",
  icon: "Microphone",
  color: "#FF6B3D",
  prompt_body: "",
  output_language: null,
  model: null,
  hotkey: null,
  is_default: 0,
  is_upload_only: 0,
  is_favorite: 0,
  created_at: Date.now(),
  updated_at: Date.now(),
});

export function TemplatesPage() {
  const { templates, save, remove } = useTemplatesStore();
  const { settings } = useSettingsStore();
  const { t, lang } = useLang();
  const [editing, setEditing] = useState<Template | null>(null);
  const [original, setOriginal] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);

  const startEditing = (tpl: Template) => {
    setEditing(tpl);
    setOriginal(tpl);
  };

  const isDirty = !!editing && JSON.stringify(editing) !== JSON.stringify(original);
  const canSave = isDirty && !!editing?.name.trim() && !!editing?.prompt_body.trim() && !hotkeyError;

  const handleSave = async () => {
    if (!editing || !canSave) return;
    setSaving(true);
    const saved = { ...editing, updated_at: Date.now() };
    await save(saved);
    setSaving(false);
    setOriginal(saved);
    setEditing(saved);
  };

  useEffect(() => {
    if (!editing || !editing.hotkey) { setHotkeyError(null); return; }
    const norm = normalizeAccelerator(editing.hotkey);
    const conflict = templates.find((tpl) => tpl.id !== editing.id && normalizeAccelerator(tpl.hotkey) === norm);
    setHotkeyError(conflict ? t("tpl_hk_conflict", getTemplateName(conflict, lang)) : null);
  }, [editing?.hotkey, editing?.id, templates, t, lang]);

  return (
    <div className="flex flex-col h-full">
      <header className="page-header">
        <h1 className="page-title">{t("tpl_title")}</h1>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary">
            <Save size={16} strokeWidth={1.75} />
            {saving ? t("tpl_saving") : t("tpl_save")}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 flex flex-col" style={{ borderInlineStart: "1px solid var(--border)", background: "var(--surface)", backdropFilter: "blur(10px)" }}>
          <div className="flex-1 overflow-y-auto">
          {templates.map((tpl) => {
            const hk = formatAccelerator(tpl.hotkey);
            const isSelected = editing?.id === tpl.id;
            const isFav = tpl.is_favorite === 1;
            return (
              <div key={tpl.id} className="p-4 flex items-center justify-between group cursor-pointer transition-colors" style={{ borderBottom: "1px solid var(--border)", background: isSelected ? "var(--accent-soft)" : "transparent" }} onClick={() => startEditing({ ...tpl })}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold truncate" style={{ color: isSelected ? "var(--accent)" : "var(--text)" }}>{getTemplateName(tpl, lang)}</p>
                    {hk && <span className="kbd shrink-0" dir="ltr">{hk}</span>}
                  </div>
                  <p className="text-xs line-clamp-1" style={{ color: "var(--muted)" }}>{tpl.prompt_body}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      save({ ...tpl, is_favorite: isFav ? 0 : 1 });
                      if (editing?.id === tpl.id) {
                        setEditing({ ...editing, is_favorite: isFav ? 0 : 1 });
                        if (original) setOriginal({ ...original, is_favorite: isFav ? 0 : 1 });
                      }
                    }} 
                    className={`p-1.5 transition-all ${isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} 
                    style={{ color: isFav ? "#EAB308" : "var(--muted)", borderRadius: 8 }}
                  >
                    <Star size={14} fill={isFav ? "#EAB308" : "none"} strokeWidth={1.75} />
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      remove(tpl.id);
                      if (editing?.id === tpl.id) { setEditing(null); setOriginal(null); }
                    }} 
                    className="opacity-0 group-hover:opacity-100 p-1.5 transition-all" 
                    style={{ color: "var(--danger)", borderRadius: 8 }}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
          <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => startEditing(EMPTY_TEMPLATE())} className="btn-primary w-full justify-center">
              <Plus size={14} strokeWidth={2} /> {t("tpl_new")}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {editing ? (
            <div className="p-6 space-y-5 max-w-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                  {getTemplateName(editing, lang) || t("tpl_new")}
                </h2>
                <button onClick={() => { setEditing(null); setOriginal(null); }} className="icon-btn" style={{ width: 32, height: 32 }}>
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="section-label">{t("tpl_name")}</label>
                <input
                  type="text"
                  value={getTemplateName(editing, lang)}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value, name_en: undefined })}
                  className="input-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="section-label">{t("tpl_prompt")}</label>
                <textarea value={editing.prompt_body} onChange={(e) => setEditing({ ...editing, prompt_body: e.target.value })} rows={8} className="input-base resize-none" />
              </div>

              <div className="space-y-1.5">
                <label className="section-label">{t("tpl_out_lang")}</label>
                <Select
                  value={editing.output_language ?? "auto"}
                  onChange={(v) => setEditing({ ...editing, output_language: v === "auto" ? null : v as "en" | "ar" })}
                  options={[
                    { value: "auto", label: t("tpl_lang_auto") },
                    { value: "en",   label: t("tpl_lang_en") },
                    { value: "ar",   label: t("tpl_lang_ar") },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                {(() => {
                  const defLabel = settings.selectedModel === AUTO_MODEL_ID
                    ? t("quota_auto")
                    : (KNOWN_MODELS.find((m) => m.id === settings.selectedModel)?.label ?? settings.selectedModel);
                  return (
                    <>
                      <label className="section-label">{t("tpl_model", defLabel)}</label>
                      <Select
                        value={editing.model ?? ""}
                        onChange={(v) => setEditing({ ...editing, model: v || null })}
                        dir="ltr"
                        options={[
                          { value: "", label: t("tpl_model_def", defLabel) },
                          ...KNOWN_MODELS.map((m) => ({ value: m.id, label: m.label, hint: m.id })),
                        ]}
                      />
                    </>
                  );
                })()}
              </div>

              <HotkeyField value={editing.hotkey} onChange={(hk) => setEditing({ ...editing, hotkey: hk })} error={hotkeyError} />

              <div className="space-y-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t("tpl_favorite")}</span>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{t("tpl_favorite_desc")}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editing.is_favorite === 1}
                    onChange={(e) => setEditing({ ...editing, is_favorite: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t("tpl_upload_only")}</span>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{t("tpl_upload_only_desc")}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editing.is_upload_only === 1}
                    onChange={(e) => setEditing({ ...editing, is_upload_only: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm h-full" style={{ color: "var(--muted)" }}>
              {t("tpl_select")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

