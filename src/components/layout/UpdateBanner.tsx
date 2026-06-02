import { X, ArrowUpCircle } from "lucide-react";
import { useLang } from "../../lib/useLang";

type Phase = "available" | "downloading" | "ready" | "error";

interface Props {
  version: string;
  phase: Phase;
  downloaded?: number;
  total?: number | null;
  /** Block the restart action (e.g. while a recording is in progress). */
  restartBlocked?: boolean;
  onDownload: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({
  version,
  phase,
  downloaded = 0,
  total = null,
  restartBlocked = false,
  onDownload,
  onRestart,
  onDismiss,
}: Props) {
  const { t } = useLang();

  const pct = total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;

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
