// SPDX-License-Identifier: AGPL-3.0-or-later

import { X, ArrowUpCircle } from "lucide-react";
import { useLang } from "../../lib/useLang";

type Phase = "available" | "downloading" | "ready" | "error";

interface Props {
  version: string;
  phase: Phase;
  /** Release notes (markdown) for the pending version, shown so the user can
   *  see what changed before installing. */
  notes?: string | null;
  downloaded?: number;
  total?: number | null;
  /** Block the restart action (e.g. while a recording is in progress). */
  restartBlocked?: boolean;
  onDownload: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

// The notes come from the GitHub release body (markdown). Strip the heavier
// markdown so they read cleanly in the compact toast, without pulling in a
// full markdown renderer.
function cleanNotes(md: string): string {
  return md
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/, "") // headings
        .replace(/^\s*[-*]\s+/, "• ") // bullets
        .replace(/\*\*(.+?)\*\*/g, "$1") // bold
        .replace(/`([^`]+)`/g, "$1"), // inline code
    )
    .filter((line) => line.trim() !== "---") // horizontal rules
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function UpdateBanner({
  version,
  phase,
  notes = null,
  downloaded = 0,
  total = null,
  restartBlocked = false,
  onDownload,
  onRestart,
  onDismiss,
}: Props) {
  const { t } = useLang();

  const pct = total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;

  // Show the "what's new" notes before the user commits to installing — i.e.
  // when an update is available or already downloaded and waiting to install.
  const cleanedNotes = notes ? cleanNotes(notes) : "";
  const showNotes = !!cleanedNotes && (phase === "available" || phase === "ready");

  const title =
    phase === "ready"
      ? t("upd_ready")
      : phase === "error"
        ? t("upd_error")
        : t("upd_available");

  return (
    <div
      className="flex items-start gap-3 p-4"
      style={{
        width: 320,
        background: "var(--toast-bg)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        border: "1px solid var(--toast-accent-ring)",
        borderRadius: 18,
        boxShadow: "var(--toast-shadow), 0 0 28px -2px var(--toast-accent-glow)",
        animation: "toast-in 0.22s ease-out",
      }}
    >
      <div
        className="shrink-0 w-9 h-9 rounded-xl grid place-items-center"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <ArrowUpCircle size={18} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
          {title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {phase === "downloading"
            ? pct !== null
              ? `${t("upd_downloading")} ${pct}%`
              : t("upd_downloading")
            : t("upd_desc", version)}
        </p>

        {phase === "downloading" && (
          <div
            className="mt-2 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--accent-soft)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{
                width: pct !== null ? `${pct}%` : "40%",
                background: "var(--accent)",
                animation: pct === null ? "indeterminate 1.1s ease-in-out infinite" : undefined,
              }}
            />
          </div>
        )}

        {showNotes && (
          <div className="mt-2.5">
            <p
              className="text-[11px] font-semibold mb-1"
              style={{ color: "var(--text-2)" }}
            >
              {t("upd_whatsnew")}
            </p>
            <div
              className="rounded-lg p-2.5 text-xs leading-relaxed overflow-y-auto"
              style={{
                maxHeight: 140,
                background: "var(--accent-soft)",
                color: "var(--text-2)",
                whiteSpace: "pre-wrap",
              }}
            >
              {cleanedNotes}
            </div>
          </div>
        )}

        {phase === "available" && (
          <button
            type="button"
            onClick={onDownload}
            className="inline-block mt-3 px-4 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-85"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {t("upd_download")}
          </button>
        )}

        {phase === "ready" && (
          <button
            type="button"
            onClick={onRestart}
            disabled={restartBlocked}
            className="inline-block mt-3 px-4 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {restartBlocked ? t("upd_restart_blocked") : t("upd_restart")}
          </button>
        )}

        {phase === "error" && (
          <button
            type="button"
            onClick={onDownload}
            className="inline-block mt-3 px-4 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-85"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {t("upd_retry")}
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
