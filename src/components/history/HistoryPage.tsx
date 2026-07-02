// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { useHistoryStore } from "../../stores/historyStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLang } from "../../lib/useLang";

function getTemplateName(tpl: { name: string; name_en?: string } | null, lang: string, fallback: string): string {
  if (!tpl) return fallback;
  return lang === "en" && tpl.name_en ? tpl.name_en : tpl.name;
}


export function HistoryPage() {
  const { items, load, setSearch, search, remove, clear } = useHistoryStore();
  const { settings } = useSettingsStore();
  const { t, lang, isRTL } = useLang();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  if (!settings.saveHistory) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
        {t("hist_disabled")}
      </div>
    );
  }

  const selectedItem = items.find((i) => i.id === selected);
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  return (
    <div className="flex flex-col h-full">
      <header className="page-header">
        <h1 className="page-title">{t("hist_title")}</h1>
        {items.length > 0 && (
          <button onClick={clear} className="btn-danger">
            <Trash2 size={13} strokeWidth={1.75} />
            {t("hist_clear")}
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 flex flex-col" style={{ borderInlineStart: "1px solid var(--border)", background: "var(--surface)", backdropFilter: "blur(10px)" }}>
          <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search size={14} strokeWidth={1.75} className="absolute top-1/2 -translate-y-1/2" style={{ color: "var(--muted)", [isRTL ? "right" : "left"]: 10 }} />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("hist_search")} className="input-base text-sm" style={{ [isRTL ? "paddingRight" : "paddingLeft"]: 32 }} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: "var(--muted)" }}>{t("hist_empty")}</div>
            ) : (
              items.map((item) => {
                const snapshot = item.template_snapshot ? JSON.parse(item.template_snapshot) : null;
                const isSelected = selected === item.id;
                return (
                  <button key={item.id} onClick={() => setSelected(item.id)} className="w-full text-start p-3 transition-colors" style={{ borderBottom: "1px solid var(--border)", background: isSelected ? "var(--accent-soft)" : "transparent" }}>
                    <p className="text-xs font-bold mb-1" style={{ color: "var(--accent)" }}>
                      {getTemplateName(snapshot, lang, t("hist_deleted"))} · {item.model}
                    </p>
                    <p className="text-xs line-clamp-2" style={{ color: "var(--text-2)" }}>{item.output_text}</p>
                    <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                      {new Date(item.created_at).toLocaleString(locale)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", backdropFilter: "blur(10px)" }}>
                <span className="chip">
                  <span className="font-mono">~{selectedItem.estimated_tokens} tokens</span>
                  <span style={{ color: "var(--muted)" }}>·</span>
                  <span className="font-mono">{selectedItem.model}</span>
                </span>
                <button onClick={() => { remove(selectedItem.id); setSelected(null); }} className="btn-danger">
                  <Trash2 size={12} strokeWidth={1.75} /> {t("hist_delete")}
                </button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <p className="leading-relaxed text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                  {selectedItem.output_text}
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
              {t("hist_select")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
