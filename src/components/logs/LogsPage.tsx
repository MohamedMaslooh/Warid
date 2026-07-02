// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef } from "react";
import { Trash2, Copy } from "lucide-react";
import { useLogStore, type LogEntry } from "../../stores/logStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useLang } from "../../lib/useLang";

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  info:    "var(--muted)",
  warn:    "var(--warning)",
  error:   "var(--danger)",
  success: "var(--success)",
};

const LEVEL_BADGE: Record<LogEntry["level"], string> = {
  info:    "INFO ",
  warn:    "WARN ",
  error:   "ERROR",
  success: "  OK ",
};

function fmtTs(ts: number) {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function LogsPage() {
  const { entries, clear } = useLogStore();
  const { settings } = useSettingsStore();
  const { t } = useLang();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  const copyAll = async () => {
    const text = entries
      .map((e) => `[${fmtTs(e.ts)}] [${LEVEL_BADGE[e.level].trim()}] ${e.msg}${e.detail ? `\n  → ${e.detail}` : ""}`)
      .join("\n");
    await writeText(text);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">{t("logs_title")}</h1>
          {entries.length > 0 && (
            <span className="chip font-mono">{entries.length} entries</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <>
              <button onClick={copyAll} className="btn-secondary" style={{ padding: "7px 12px", fontSize: 12 }}>
                <Copy size={13} strokeWidth={1.75} /> {t("logs_copy")}
              </button>
              <button onClick={clear} className="btn-danger">
                <Trash2 size={13} strokeWidth={1.75} /> {t("logs_clear")}
              </button>
            </>
          )}
        </div>
      </header>

      {!settings.logsEnabled ? (
        <div className="flex-1 flex items-center justify-center text-sm flex-col gap-2" style={{ color: "var(--muted)" }}>
          <span>{t("logs_disabled")}</span>
          <span className="text-xs">{t("logs_dis_hint")}</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
          {t("logs_empty")}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs" dir="ltr" style={{ background: "var(--bg)", color: "var(--text-2)" }}>
          {entries.map((e) => (
            <div key={e.id} className="mb-1 leading-relaxed">
              <span style={{ color: "var(--muted)" }}>[{fmtTs(e.ts)}]</span>
              {" "}
              <span className="font-bold" style={{ color: LEVEL_COLOR[e.level] }}>[{LEVEL_BADGE[e.level]}]</span>
              {" "}
              <span style={{ color: "var(--text)" }}>{e.msg}</span>
              {e.detail && (
                <div className="ml-24 break-all" style={{ color: "var(--muted)" }}>{e.detail}</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
