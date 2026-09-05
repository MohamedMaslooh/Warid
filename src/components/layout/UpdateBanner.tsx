// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLayoutEffect, useRef, useState } from "react";
import { X, ArrowDownCircle, ChevronDown, AlertTriangle } from "lucide-react";
import { useLang } from "../../lib/useLang";
import {
  parseReleaseNotes,
  sectionTone,
  type NoteBlock,
  type SectionTone,
  type Span,
} from "../../lib/releaseNotes";

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

/** Height the notes panel is capped at before the user expands it. */
const COLLAPSED_MAX = 196;
const EXPANDED_MAX = 340;

/** Softens the bottom edge of the notes panel while more text is scrolled out. */
const FADE_MASK = "linear-gradient(to bottom, #000 calc(100% - 28px), transparent)";

const TONE_COLOR: Record<SectionTone, string> = {
  added: "var(--success)",
  fixed: "var(--accent)",
  changed: "var(--warning)",
  neutral: "var(--muted)",
};

const TONE_BG: Record<SectionTone, string> = {
  added: "var(--success-bg)",
  fixed: "var(--accent-soft)",
  changed: "var(--warning-bg)",
  neutral: "var(--surface-2)",
};

/** Renders one line's styled spans — bold lead-ins ("Problem:") carry the eye,
 *  code spans get a monospace chip so paths stop looking like broken prose. */
function Line({ spans, color }: { spans: Span[]; color: string }) {
  return (
    <>
      {spans.map((s, i) =>
        s.code ? (
          <code
            key={i}
            className="px-1 py-px rounded font-mono text-[10px]"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            {s.text}
          </code>
        ) : (
          <span
            key={i}
            style={{
              color: s.bold ? "var(--text)" : color,
              fontWeight: s.bold ? 600 : undefined,
              fontStyle: s.italic ? "italic" : undefined,
            }}
          >
            {s.text}
          </span>
        ),
      )}
    </>
  );
}

function NoteBlocks({ blocks }: { blocks: NoteBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        // Groups after the first get breathing room above them.
        const spaced = i > 0 ? "mt-3" : "";

        if (b.kind === "section") {
          const tone = sectionTone(b.label);
          return (
            <div key={i} className={`flex items-center gap-2 ${spaced}`}>
              <span
                className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                style={{ background: TONE_BG[tone], color: TONE_COLOR[tone] }}
              >
                {b.label}
              </span>
              <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>
          );
        }

        if (b.kind === "heading") {
          return (
            <p
              key={i}
              dir="auto"
              className={`text-[11.5px] font-semibold leading-snug ${i > 0 ? "mt-2.5" : ""}`}
              style={{ color: "var(--text)" }}
            >
              <Line spans={b.spans} color="var(--text)" />
            </p>
          );
        }

        if (b.kind === "quote") {
          return (
            <p
              key={i}
              dir="auto"
              className="mt-2 ps-2 text-[11px] leading-relaxed"
              style={{
                borderInlineStart: "2px solid var(--border-2)",
                color: "var(--muted)",
              }}
            >
              <Line spans={b.spans} color="var(--muted)" />
            </p>
          );
        }

        if (b.kind === "bullet") {
          return (
            <div
              key={i}
              dir="auto"
              className="flex gap-2 mt-1.5 text-[11px] leading-relaxed"
              style={{ paddingInlineStart: b.depth ? 12 : 0 }}
            >
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  marginTop: 6,
                  background: b.depth ? "var(--border-2)" : "var(--accent)",
                  opacity: b.depth ? 1 : 0.65,
                }}
              />
              <p className="flex-1 min-w-0" style={{ color: "var(--text-2)" }}>
                <Line spans={b.spans} color="var(--text-2)" />
              </p>
            </div>
          );
        }

        return (
          <p
            key={i}
            dir="auto"
            className="mt-1.5 text-[11px] leading-relaxed"
            style={{ color: "var(--text-2)" }}
          >
            <Line spans={b.spans} color="var(--text-2)" />
          </p>
        );
      })}
    </>
  );
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
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pct = total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;

  // Show the "what's new" notes before the user commits to installing — i.e.
  // when an update is available or already downloaded and waiting to install.
  const blocks = notes ? parseReleaseNotes(notes) : [];
  const showNotes = blocks.length > 0 && (phase === "available" || phase === "ready");

  // Only offer "show all" when there is actually more to see.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > COLLAPSED_MAX + 8);
    setAtEnd(el.scrollHeight - el.clientHeight - el.scrollTop < 8);
  }, [notes, showNotes, expanded]);

  const isError = phase === "error";
  const title = phase === "ready" ? t("upd_ready") : isError ? t("upd_error") : t("upd_available");

  const subtitle =
    phase === "downloading"
      ? pct !== null
        ? `${t("upd_downloading")} ${pct}%`
        : t("upd_downloading")
      : t("upd_desc", version);

  const action =
    phase === "ready"
      ? { label: restartBlocked ? t("upd_restart_blocked") : t("upd_restart"), run: onRestart }
      : isError
        ? { label: t("upd_retry"), run: onDownload }
        : phase === "available"
          ? { label: t("upd_download"), run: onDownload }
          : null;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: 380,
        background: "var(--toast-bg)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        border: `1px solid ${isError ? "var(--danger)" : "var(--toast-accent-ring)"}`,
        borderRadius: 18,
        boxShadow: "var(--toast-shadow), 0 0 28px -2px var(--toast-accent-glow)",
        animation: "toast-in 0.22s ease-out",
      }}
    >
      {/* Header — icon, what happened, dismiss */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <div
          className="shrink-0 w-9 h-9 rounded-xl grid place-items-center"
          style={{
            background: isError ? "var(--danger-bg)" : "var(--accent-soft)",
            color: isError ? "var(--danger)" : "var(--accent)",
          }}
        >
          {isError ? (
            <AlertTriangle size={17} strokeWidth={2} />
          ) : (
            <ArrowDownCircle size={18} strokeWidth={2} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
            {title}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 -me-1 w-7 h-7 rounded-lg grid place-items-center transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: "var(--muted)" }}
          aria-label={t("upd_dismiss")}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {phase === "downloading" && (
        <div
          className="mx-4 mt-3 h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--accent-soft)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{
              width: pct !== null ? `${pct}%` : "40%",
              background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
              animation: pct === null ? "indeterminate 1.1s ease-in-out infinite" : undefined,
            }}
          />
        </div>
      )}

      {showNotes && (
        <div className="mt-3.5 px-4">
          <div className="flex items-center gap-2 mb-1.5">
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--muted)" }}
            >
              {t("upd_whatsnew")}
            </p>
            <span
              className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold font-mono"
              style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
            >
              v{version}
            </span>
          </div>

          <div
            className="relative rounded-xl"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                setAtEnd(el.scrollHeight - el.clientHeight - el.scrollTop < 8);
              }}
              className="notes-scroll overflow-y-auto px-3 py-2.5"
              style={{
                maxHeight: expanded ? EXPANDED_MAX : COLLAPSED_MAX,
                // Fade the cut-off line so it reads as "there is more below",
                // not as a sentence chopped in half. A mask (rather than a
                // gradient overlay) keeps it correct on either theme, whatever
                // the translucent panel is sitting on.
                ...(atEnd ? {} : { maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }),
              }}
            >
              <NoteBlocks blocks={blocks} />
            </div>
          </div>

          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 mt-1.5 text-[11px] font-semibold transition-opacity hover:opacity-75"
              style={{ color: "var(--accent)" }}
            >
              {expanded ? t("upd_show_less") : t("upd_show_all")}
              <ChevronDown
                size={12}
                strokeWidth={2.5}
                style={{
                  transform: expanded ? "rotate(180deg)" : undefined,
                  transition: "transform .18s ease",
                }}
              />
            </button>
          )}
        </div>
      )}

      {action && (
        <div className="px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={action.run}
            disabled={phase === "ready" && restartBlocked}
            className="btn-primary w-full"
            style={isError ? { background: "var(--danger)", boxShadow: "none" } : undefined}
          >
            {action.label}
          </button>
        </div>
      )}

      {!action && <div className="pb-4" />}
    </div>
  );
}
