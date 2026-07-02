// SPDX-License-Identifier: AGPL-3.0-or-later

import { X, Trophy, Check } from "lucide-react";
import { useState } from "react";
import { useLang } from "../../lib/useLang";

interface Props {
  milestone: number;
  timeSavedMin: number;
  onDismiss: () => void;
}

function formatTimeSaved(timeSavedMin: number, t: (key: string, ...args: string[]) => string): string {
  if (timeSavedMin < 1) return t("time_less_min");
  if (timeSavedMin < 60) return t("time_min", String(Math.round(timeSavedMin)));
  let hrs = Math.floor(timeSavedMin / 60);
  let mins = Math.round(timeSavedMin % 60);
  if (mins === 60) { hrs += 1; mins = 0; }
  return mins > 0 ? t("time_hour_min", String(hrs), String(mins)) : t("time_hour", String(hrs));
}

export function MilestoneBanner({ milestone, timeSavedMin, onDismiss }: Props) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const savedText = formatTimeSaved(timeSavedMin, t as (key: string, ...args: string[]) => string);

  function handleShare() {
    navigator.clipboard.writeText(t("ms_banner_share_text")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div
      className="flex items-start gap-3 p-4"
      style={{
        width: 320,
        background: "var(--toast-bg)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        border: "1px solid var(--toast-success-ring)",
        borderRadius: 18,
        boxShadow: "var(--toast-shadow), 0 0 28px -2px var(--toast-success-glow)",
        animation: "toast-in 0.22s ease-out",
      }}
    >
      <div
        className="shrink-0 w-9 h-9 rounded-xl grid place-items-center"
        style={{ background: "var(--success-bg)", color: "var(--success)" }}
      >
        <Trophy size={18} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
          {t("ms_banner_title", milestone.toLocaleString())}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted)" }}>
          {milestone >= 2500 ? t("ms_banner_body", savedText) : t("ms_banner_body_simple", savedText)}
        </p>
        {milestone >= 2500 && (
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-85"
            style={{ background: copied ? "var(--success)" : "var(--success)", color: "#fff", opacity: copied ? 0.85 : 1 }}
          >
            {copied ? <><Check size={11} strokeWidth={2.5} />{t("ms_banner_copied")}</> : t("ms_banner_share")}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 w-7 h-7 rounded-lg grid place-items-center transition-opacity hover:opacity-80"
        style={{ color: "var(--muted)" }}
        aria-label={t("upd_dismiss")}
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
