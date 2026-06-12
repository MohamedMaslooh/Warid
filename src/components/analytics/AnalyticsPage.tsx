import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart2, Clock, Zap, Mic, Trophy, Star, Crown,
  AudioLines, Rocket, Sparkles, Flame, Gem, Target,
  Activity, Flag, Calendar, Quote, TrendingUp,
} from "lucide-react";
import { useAnalyticsStore } from "../../stores/analyticsStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLang } from "../../lib/useLang";
import type { ParsedMilestone } from "../../stores/analyticsStore";
import type { DailyActivity } from "../../lib/db";
import type { LangKey } from "../../lib/i18n";

const MILESTONES_CONFIG: Array<{
  at: number;
  labelKey: LangKey;
  short: string;
  Icon: React.ElementType;
}> = [
  { at: 100,       labelKey: "ms_100",      short: "100",  Icon: AudioLines },
  { at: 500,       labelKey: "ms_500",      short: "500",  Icon: Rocket     },
  { at: 1_000,     labelKey: "ms_1000",     short: "1K",   Icon: Star       },
  { at: 2_500,     labelKey: "ms_2500",     short: "2.5K", Icon: Flame      },
  { at: 5_000,     labelKey: "ms_5000",     short: "5K",   Icon: Gem        },
  { at: 10_000,    labelKey: "ms_10000",    short: "10K",  Icon: Trophy     },
  { at: 25_000,    labelKey: "ms_25000",    short: "25K",  Icon: Sparkles   },
  { at: 50_000,    labelKey: "ms_50000",    short: "50K",  Icon: Target     },
  { at: 100_000,   labelKey: "ms_100000",   short: "100K", Icon: Crown      },
  { at: 150_000,   labelKey: "ms_150000",   short: "150K", Icon: Rocket     },
  { at: 200_000,   labelKey: "ms_200000",   short: "200K", Icon: Star       },
  { at: 250_000,   labelKey: "ms_250000",   short: "250K", Icon: Flame      },
  { at: 300_000,   labelKey: "ms_300000",   short: "300K", Icon: Gem        },
  { at: 350_000,   labelKey: "ms_350000",   short: "350K", Icon: Trophy     },
  { at: 400_000,   labelKey: "ms_400000",   short: "400K", Icon: Sparkles   },
  { at: 450_000,   labelKey: "ms_450000",   short: "450K", Icon: Target     },
  { at: 500_000,   labelKey: "ms_500000",   short: "500K", Icon: Crown      },
  { at: 550_000,   labelKey: "ms_550000",   short: "550K", Icon: Rocket     },
  { at: 600_000,   labelKey: "ms_600000",   short: "600K", Icon: Star       },
  { at: 650_000,   labelKey: "ms_650000",   short: "650K", Icon: Flame      },
  { at: 700_000,   labelKey: "ms_700000",   short: "700K", Icon: Gem        },
  { at: 750_000,   labelKey: "ms_750000",   short: "750K", Icon: Trophy     },
  { at: 800_000,   labelKey: "ms_800000",   short: "800K", Icon: Sparkles   },
  { at: 850_000,   labelKey: "ms_850000",   short: "850K", Icon: Target     },
  { at: 900_000,   labelKey: "ms_900000",   short: "900K", Icon: Crown      },
  { at: 950_000,   labelKey: "ms_950000",   short: "950K", Icon: Star       },
  { at: 1_000_000, labelKey: "ms_1000000",  short: "1M",   Icon: Crown      },
];

const HEATMAP_WEEKS = 26;
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;

function formatTime(minutes: number, t: (key: LangKey, ...args: string[]) => string): string {
  if (minutes < 1) return t("time_less_min");
  if (minutes < 60) return t("time_min", String(Math.round(minutes)));
  let h = Math.floor(minutes / 60);
  let m = Math.round(minutes % 60);
  if (m === 60) { h += 1; m = 0; }
  if (m === 0) return t("time_hour", String(h));
  return t("time_hour_min", String(h), String(m));
}

function formatNumber(n: number, t: (key: LangKey, ...args: string[]) => string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}${t("num_m")}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}${t("num_k")}`;
  return n.toLocaleString();
}

function HeroProgress({
  totalWords, next, etaDays,
}: {
  totalWords: number; next: number | null; etaDays: number | null;
}) {
  const { t, isRTL } = useLang();

  if (!next) {
    return (
      <div className="card flex items-center justify-center text-center relative overflow-hidden" style={{ padding: 20, gridColumn: "span 5", minHeight: 156 }}>
        <div className="absolute pointer-events-none" style={{ inset: 0, background: "radial-gradient(circle at 100% 0%, var(--accent-soft), transparent 60%)" }} />
        <div className="relative">
          <Crown size={28} style={{ color: "var(--accent)", margin: "0 auto 8px" }} />
          <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{t("anl_all_ms")}</p>
        </div>
      </div>
    );
  }

  // The *previous* milestone is the highest one strictly below `next`.
  const lowerOnes = MILESTONES_CONFIG.filter((m) => m.at < next);
  const prev = lowerOnes.length ? lowerOnes[lowerOnes.length - 1].at : 0;

  const progress = Math.min(Math.max(((totalWords - prev) / (next - prev)) * 100, 0), 100);
  const remaining = Math.max(next - totalWords, 0);
  const cfg = MILESTONES_CONFIG.find((m) => m.at === next);
  const NextIcon = cfg?.Icon ?? Star;
  const gradDir = isRTL ? "left" : "right";

  return (
    <div className="card relative overflow-hidden" style={{ padding: 20, gridColumn: "span 5", minHeight: 156 }}>
      <div className="absolute pointer-events-none" style={{ inset: 0, background: "radial-gradient(circle at 100% 0%, var(--accent-soft), transparent 60%)" }} />

      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="section-label" style={{ color: "var(--accent)" }}>{t("anl_words")}</span>
          <div
            className="font-black tabular-nums"
            style={{ marginTop: 6, fontSize: 34, lineHeight: 1, letterSpacing: "-0.03em", color: "var(--text)", fontFamily: '"Inter", system-ui, sans-serif' }}
          >
            {totalWords.toLocaleString()}
          </div>
        </div>
        <div className="text-end shrink-0">
          <div
            className="font-black tabular-nums"
            style={{ color: "var(--accent)", fontSize: 22, lineHeight: 1, letterSpacing: "-0.02em", fontFamily: '"Inter", system-ui, sans-serif' }}
          >
            {Math.round(progress)}%
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>{t("anl_to_next")}</p>
        </div>
      </div>

      <div className="relative">
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(to ${gradDir}, var(--accent), var(--accent-2))`,
              boxShadow: "0 0 8px var(--accent-soft)",
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 gap-3 text-xs" style={{ color: "var(--muted)" }}>
        <span className="tabular-nums">{prev.toLocaleString()}</span>
        <span className="flex items-center gap-1.5 min-w-0">
          <NextIcon size={12} strokeWidth={2} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span className="font-bold tabular-nums" style={{ color: "var(--text-2)" }}>
            {next.toLocaleString()}
          </span>
          <span className="truncate" style={{ color: "var(--muted)" }}>
            {etaDays !== null
              ? <>· {etaDays <= 1 ? t("anl_eta_soon") : t("anl_eta_days", String(etaDays))}</>
              : <>· {t("anl_away", remaining.toLocaleString())}</>}
          </span>
        </span>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string;
}) {
  return (
    <div className="card flex flex-col justify-between" style={{ padding: 18, minHeight: 156 }}>
      <div className="flex items-center justify-between">
        <span className="section-label">{label}</span>
        <div className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Icon size={14} strokeWidth={2} />
        </div>
      </div>
      <div>
        <div className="font-black" style={{ fontSize: 30, lineHeight: 1, letterSpacing: "-0.03em", color: "var(--text)" }}>
          {value}
        </div>
        {sub && <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function ActivityChart({
  cells, lang, t,
}: {
  cells: Array<{ key: number; words: number }>;
  lang: string;
  t: (key: string, ...args: string[]) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ index: number; clientX: number; clientY: number } | null>(null);

  const n = cells.length;
  const max = useMemo(() => Math.max(...cells.map((c) => c.words), 1), [cells]);

  const W = 1000;
  const H = 52;
  const PAD_TOP = 5;
  const stepX = W / Math.max(n - 1, 1);

  const pts = useMemo(
    () => cells.map((c, i) => [
      i * stepX,
      PAD_TOP + (1 - c.words / max) * (H - PAD_TOP),
    ] as [number, number]),
    [cells, max, stepX],
  );

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `M0,${H} ${pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} L${pts[n - 1][0].toFixed(1)},${H} Z`;

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const index = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - rect.left) / rect.width) * (n - 1))));
    setHover({ index, clientX: e.clientX, clientY: e.clientY });
  }

  const hoverCell = hover ? cells[hover.index] : null;
  const hoverPt = hover ? pts[hover.index] : null;

  return (
    <div className="mt-4" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: 52, display: "block", cursor: "crosshair" }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="act-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#act-grad)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {hoverPt && (
          <line x1={hoverPt[0]} y1={PAD_TOP} x2={hoverPt[0]} y2={H} stroke="var(--accent)" strokeWidth="0.8" opacity="0.55" />
        )}
      </svg>
      {hover && hoverCell && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: hover.clientX + 14,
            top: hover.clientY - 14,
            zIndex: 9999,
            pointerEvents: "none",
            padding: "8px 12px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--surface) 82%, transparent)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            border: "1px solid var(--accent-border)",
            boxShadow: "0 12px 32px -8px rgba(0,0,0,.55), 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
            color: "var(--text)",
            fontSize: 12,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
          }}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <div className="font-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {new Date(hoverCell.key).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
          </div>
          <div className="font-bold" style={{ color: "var(--accent)", fontFamily: '"Inter", system-ui, sans-serif' }}>
            {t("anl_word_count", hoverCell.words.toLocaleString())}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function MilestoneSegments({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex gap-1 mt-3">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="flex-1 rounded-full"
          style={{
            height: 6,
            background: i < done
              ? "linear-gradient(90deg, var(--accent-2), var(--accent))"
              : "var(--surface-3)",
          }}
        />
      ))}
    </div>
  );
}

function Heatmap({ daily }: { daily: DailyActivity[] }) {
  const { t, lang } = useLang();
  const [hover, setHover] = useState<{ key: number; words: number; x: number; y: number } | null>(null);

  const cells = useMemo(() => {
    const byDay = new Map(daily.map((d) => [d.day, d.words]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: Array<{ key: number; words: number }> = [];
    for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
      const t = today.getTime() - i * 86_400_000;
      result.push({ key: t, words: byDay.get(t) ?? 0 });
    }
    return result;
  }, [daily]);

  const max = cells.reduce((m, c) => Math.max(m, c.words), 0);

  function levelOf(words: number): number {
    if (words === 0 || max === 0) return 0;
    const ratio = words / max;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.8) return 3;
    return 4;
  }

  function bgFor(level: number): string {
    if (level === 0) return "var(--surface-2)";
    if (level === 4) return "linear-gradient(180deg, var(--accent-2), var(--accent))";
    const pct = level === 1 ? 18 : level === 2 ? 38 : 62;
    return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
  }

  return (
    <div className="card" style={{ padding: 22, gridColumn: "span 8" }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} style={{ color: "var(--accent)" }} />
        <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{t("anl_activity")}</span>
      </div>
      <div
        dir="ltr"
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, 1fr)`,
          gridTemplateRows: "repeat(7, 1fr)",
          gridAutoFlow: "column",
        }}
      >
        {cells.map((c) => {
          const lvl = levelOf(c.words);
          return (
            <div
              key={c.key}
              onMouseEnter={(e) => setHover({ key: c.key, words: c.words, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover((h) => (h && h.key === c.key ? { ...h, x: e.clientX, y: e.clientY } : h))}
              onMouseLeave={() => setHover((h) => (h && h.key === c.key ? null : h))}
              style={{
                aspectRatio: "1",
                borderRadius: 3,
                background: bgFor(lvl),
                border: lvl === 0 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
      {hover && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: hover.x + 14,
            top: hover.y - 14,
            zIndex: 9999,
            pointerEvents: "none",
            padding: "8px 12px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--surface) 82%, transparent)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            border: "1px solid var(--accent-border)",
            boxShadow: "0 12px 32px -8px rgba(0,0,0,.55), 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
            color: "var(--text)",
            fontSize: 12,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
          }}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <div className="font-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {new Date(hover.key).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
          </div>
          <div className="font-bold" style={{ color: "var(--accent)", fontFamily: '"Inter", system-ui, sans-serif' }}>
            {t("anl_word_count", hover.words.toLocaleString())}
          </div>
        </div>,
        document.body,
      )}
      <div dir="ltr" className="flex items-center justify-end gap-2 mt-3 text-xs" style={{ color: "var(--muted)" }}>
        <span>{t("anl_less")}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            style={{
              width: 11, height: 11, borderRadius: 3,
              background: bgFor(l),
              border: l === 0 ? "1px solid var(--border)" : "none",
              display: "inline-block",
            }}
          />
        ))}
        <span>{t("anl_more")}</span>
      </div>
      <ActivityChart cells={cells} lang={lang} t={t as (key: string, ...args: string[]) => string} />
    </div>
  );
}

function TopWordsRank({ topWords }: { topWords: Array<{ word: string; count: number }> }) {
  const { t } = useLang();
  if (!topWords.length) return null;

  return (
    <div className="card" style={{ padding: 22, gridColumn: "span 4" }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={16} style={{ color: "var(--accent)" }} />
        <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{t("anl_top_words")}</span>
      </div>
      <div className="flex flex-col">
        {topWords.slice(0, 7).map(({ word, count }, i) => (
          <div
            key={word}
            className="grid items-center py-2"
            style={{
              gridTemplateColumns: "24px 1fr auto",
              gap: 10,
              borderBottom: i < Math.min(topWords.length, 7) - 1 ? "1px dashed var(--border)" : "none",
            }}
          >
            <span className="text-xs font-bold tabular-nums" style={{ color: "var(--muted)", fontFamily: '"Inter", system-ui, sans-serif' }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{word}</span>
            <span className="font-bold text-xs tabular-nums" style={{ color: "var(--accent-2)" }}>
              {count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneTrack({ totalWords, done }: { totalWords: number; done: Set<number> }) {
  const { t, isRTL } = useLang();
  const nextIdx = MILESTONES_CONFIG.findIndex((m) => m.at > totalWords);
  const gradDir = isRTL ? "left" : "right";

  // Calculate sliding window of 5 visible milestones
  const windowSize = 5;
  let startIdx = 0;
  if (nextIdx === -1) {
    startIdx = Math.max(0, MILESTONES_CONFIG.length - windowSize);
  } else {
    startIdx = Math.max(0, nextIdx - 1);
  }
  let endIdx = Math.min(MILESTONES_CONFIG.length - 1, startIdx + windowSize - 1);
  startIdx = Math.max(0, endIdx - windowSize + 1);

  const visibleMilestones = MILESTONES_CONFIG.slice(startIdx, endIdx + 1);
  const totalSegments = visibleMilestones.length - 1;
  const visibleNextIdx = nextIdx === -1 ? -1 : nextIdx - startIdx;
  const visibleLastDoneIdx = visibleNextIdx === -1 ? visibleMilestones.length - 1 : visibleNextIdx - 1;

  let fillPct: number;
  if (nextIdx === -1) {
    fillPct = 100;
  } else if (visibleLastDoneIdx < 0) {
    // Haven't reached the first visible milestone yet (nextIdx === 0, so startIdx === 0, visibleNextIdx === 0)
    const firstAt = visibleMilestones[0].at;
    fillPct = Math.max(0, Math.min(1, totalWords / firstAt)) * (1 / totalSegments) * 100;
  } else {
    const prevAt = visibleMilestones[visibleLastDoneIdx].at;
    const nextAt = visibleMilestones[visibleNextIdx].at;
    const seg = Math.max(0, Math.min(1, (totalWords - prevAt) / (nextAt - prevAt)));
    fillPct = ((visibleLastDoneIdx + seg) / totalSegments) * 100;
  }

  return (
    <div className="card" style={{ padding: 22, gridColumn: "span 12" }}>
      <div className="flex items-center gap-2 mb-5">
        <Flag size={16} style={{ color: "var(--accent)" }} />
        <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{t("anl_track")}</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {t("anl_track_sub", String(done.size), String(MILESTONES_CONFIG.length - done.size))}
        </span>
      </div>

      <div className="relative">
        {/* Circle row — the connecting line passes through its exact midline */}
        <div className="relative" style={{ height: 36, paddingInline: 6 }}>
          <div
            className="absolute pointer-events-none"
            style={{
              insetInlineStart: 24, insetInlineEnd: 24, top: 17, height: 2, borderRadius: 2,
              background: nextIdx === -1
                ? "linear-gradient(90deg, var(--accent-2), var(--accent))"
                : `linear-gradient(to ${gradDir}, var(--accent) 0%, var(--accent-2) ${fillPct}%, var(--border) ${fillPct}%, var(--border) 100%)`,
            }}
          />
          <div className="relative flex justify-between items-center h-full">
            {visibleMilestones.map((m, i) => {
              const isDone = done.has(m.at) || totalWords >= m.at;
              const isCurrent = !isDone && i === visibleNextIdx;
              const Icon = m.Icon;
              return (
                <div
                  key={m.at}
                  className="grid place-items-center rounded-full transition-all"
                  style={{
                    width: 36, height: 36,
                    background: isDone
                      ? "linear-gradient(180deg, var(--accent-2), var(--accent))"
                      : "var(--surface)",
                    border: isDone
                      ? "none"
                      : isCurrent
                        ? "2px solid var(--accent)"
                        : "2px solid var(--border-2)",
                    color: isDone ? "#fff" : isCurrent ? "var(--accent)" : "var(--muted)",
                    boxShadow: isDone
                      ? "0 0 0 4px var(--accent-soft), 0 0 18px var(--accent-soft)"
                      : isCurrent
                        ? "0 0 0 4px var(--accent-soft)"
                        : "none",
                  }}
                >
                  <Icon size={16} strokeWidth={isDone ? 2 : 1.75} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Label row — aligns horizontally with the circles above */}
        <div className="flex justify-between" style={{ paddingInline: 6, marginTop: 10 }}>
          {visibleMilestones.map((m, i) => {
            const isDone = done.has(m.at) || totalWords >= m.at;
            const isCurrent = !isDone && i === visibleNextIdx;
            return (
              <span
                key={m.at}
                className="text-xs font-bold tabular-nums text-center"
                style={{
                  width: 36,
                  color: isCurrent ? "var(--accent)" : isDone ? "var(--text-2)" : "var(--muted)",
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}
              >
                {m.short}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LatestReport({ milestone }: { milestone: ParsedMilestone }) {
  const { t, lang } = useLang();
  const cfg = MILESTONES_CONFIG.find((m) => m.at === milestone.wordCountAt);
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const date = new Date(milestone.createdAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  const encouragement = milestone.report.encouragement;
  const encouragementText: string = typeof encouragement === "string"
    ? encouragement
    : (encouragement as { ar: string; en: string })[lang] ?? (encouragement as { ar: string; en: string }).ar;

  const Icon = cfg?.Icon ?? Star;

  return (
    <div className="card relative overflow-hidden" style={{ padding: 26, gridColumn: "span 8" }}>
      <div className="absolute pointer-events-none" style={{ inset: 0, background: "radial-gradient(circle at 90% 10%, var(--accent-soft), transparent 50%)" }} />
      <div className="relative flex items-start justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl grid place-items-center text-white shrink-0"
            style={{
              background: "linear-gradient(180deg, var(--accent-2), var(--accent))",
              boxShadow: "0 8px 24px var(--accent-soft)",
            }}
          >
            <Icon size={20} strokeWidth={2} />
          </div>
          <div>
            <h2 className="font-black" style={{ fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1.1 }}>
              {t("anl_word_count", milestone.wordCountAt.toLocaleString())}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {cfg ? t(cfg.labelKey) : ""} · {date}
            </p>
          </div>
        </div>
        <span className="chip chip-accent shrink-0">
          <Star size={10} /> {t("anl_achieved")}
        </span>
      </div>

      <div
        className="relative p-4 rounded-xl mb-4 text-sm leading-relaxed italic"
        style={{
          background: "var(--surface-2)",
          borderInlineStart: "3px solid var(--accent)",
          color: "var(--text-2)",
        }}
      >
        <Quote size={14} style={{ color: "var(--accent)", display: "inline", marginInlineEnd: 6, verticalAlign: -2 }} />
        {encouragementText}
      </div>

      <div className="relative grid grid-cols-3 gap-2">
        <div className="panel p-3 text-center">
          <p className="text-xl font-black tabular-nums" style={{ color: "var(--accent)", fontFamily: '"Inter", system-ui, sans-serif' }}>
            {milestone.report.avgWordsPerSession}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t("anl_avg_wps")}</p>
        </div>
        <div className="panel p-3 text-center">
          <p className="text-xl font-black tabular-nums" style={{ color: "var(--accent)", fontFamily: '"Inter", system-ui, sans-serif' }}>
            {milestone.report.totalSessions}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t("anl_total_sess")}</p>
        </div>
        <div className="panel p-3 text-center">
          <p className="text-xl font-black tabular-nums" style={{ color: "var(--accent)", fontFamily: '"Inter", system-ui, sans-serif' }}>
            {milestone.report.topWords.length}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t("anl_top_words")}</p>
        </div>
      </div>
    </div>
  );
}

function PatternsCard({ milestone }: { milestone: ParsedMilestone }) {
  const { t, lang } = useLang();
  const patterns = milestone.report.patterns;
  const list: string[] = Array.isArray(patterns)
    ? patterns
    : ((patterns as { ar: string[]; en: string[] })[lang] ?? (patterns as { ar: string[]; en: string[] }).ar);

  if (!list.length) return null;

  return (
    <div className="card" style={{ padding: 22, gridColumn: "span 4" }}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} style={{ color: "var(--accent)" }} />
        <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{t("anl_patterns")}</span>
      </div>
      <div className="flex flex-col gap-2">
        {list.map((p, i) => (
          <div
            key={i}
            className="flex gap-2 items-start text-sm rounded-lg p-3"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            <span
              className="shrink-0 grid place-items-center text-xs font-bold rounded"
              style={{ width: 20, height: 20, background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 12.5 }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PastReportCard({ milestone }: { milestone: ParsedMilestone }) {
  const { t, lang } = useLang();
  const cfg = MILESTONES_CONFIG.find((m) => m.at === milestone.wordCountAt);
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const date = new Date(milestone.createdAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
  const Icon = cfg?.Icon ?? Star;

  return (
    <div className="card flex items-center gap-3" style={{ padding: 16 }}>
      <div
        className="w-10 h-10 rounded-lg grid place-items-center shrink-0"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
          {t("anl_word_count", milestone.wordCountAt.toLocaleString())}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
          {cfg ? t(cfg.labelKey) : ""} · {date}
        </p>
      </div>
      <div className="text-xs tabular-nums shrink-0" style={{ color: "var(--muted)" }}>
        {milestone.report.totalSessions} · {milestone.report.avgWordsPerSession}/s
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useLang();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24 text-center px-8">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}>
        <BarChart2 size={36} style={{ color: "var(--accent)" }} />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>{t("anl_empty_h")}</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{t("anl_empty_p")}</p>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const {
    totalWords, totalSessions, timeSavedMin, timeSavedTodayMin, effectiveWpm,
    nextMilestone: next, milestones,
    dailyActivity, currentStreak, paceWordsPerDay, bestDay,
    topWords,
    analysing, loaded, load,
  } = useAnalyticsStore();
  const { settings } = useSettingsStore();
  const { t, lang } = useLang();

  useEffect(() => { load(settings.apiKey || undefined); }, [load, settings.apiKey]);

  const latestMilestone = milestones[milestones.length - 1] ?? null;
  const doneSet = useMemo(() => new Set(milestones.map((m) => m.wordCountAt)), [milestones]);

  const remainingToNext = next ? Math.max(next - totalWords, 0) : 0;
  const etaDays = next && paceWordsPerDay > 0
    ? Math.ceil(remainingToNext / paceWordsPerDay)
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">{t("anl_title")}</h1>
          {analysing && (
            <span className="chip chip-accent animate-pulse">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              {t("anl_analysing")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="chip">
            <Mic size={11} />
            {t("anl_sessions", String(totalSessions))}
          </span>
          {currentStreak > 0 && (
            <span className="chip chip-accent">
              <Flame size={11} />
              {t("anl_streak", String(currentStreak))}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {loaded && totalWords === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-7xl mx-auto">
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>{t("anl_subtitle")}</p>

            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}
            >
              <HeroProgress totalWords={totalWords} next={next} etaDays={etaDays} />

              <div
                className="grid gap-3"
                style={{ gridColumn: "span 7", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridAutoRows: "minmax(0, 1fr)" }}
              >
                <StatCard
                  icon={Clock}
                  label={t("anl_time_saved")}
                  value={formatTime(timeSavedMin, t)}
                  sub={`${t("anl_vs_typing")} · ${formatTime(timeSavedTodayMin, t)} ${lang === "ar" ? "اليوم" : "today"}`}
                />
                <StatCard
                  icon={Zap}
                  label={t("anl_speed")}
                  value={effectiveWpm}
                  sub={t("anl_speed_unit")}
                />
                <div className="card flex flex-col justify-between" style={{ padding: 18, minHeight: 156 }}>
                  <div className="flex items-center justify-between">
                    <span className="section-label">{t("anl_milestones")}</span>
                    <div className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      <Trophy size={14} strokeWidth={2} />
                    </div>
                  </div>
                  <div>
                    <div className="font-black tabular-nums" style={{ fontSize: 30, lineHeight: 1, letterSpacing: "-0.03em", color: "var(--text)" }}>
                      {milestones.length}
                      <span style={{ color: "var(--muted)", fontSize: 16, fontWeight: 600 }}>/{MILESTONES_CONFIG.length}</span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                      {next ? t("anl_next", next.toLocaleString()) : t("anl_all_done")}
                    </p>
                    <MilestoneSegments done={milestones.length} total={MILESTONES_CONFIG.length} />
                  </div>
                </div>
              </div>

              {dailyActivity.length > 0
                ? <Heatmap daily={dailyActivity} />
                : (
                  <div className="card flex items-center justify-center text-center" style={{ padding: 22, gridColumn: "span 8", minHeight: 200 }}>
                    <div>
                      <Calendar size={32} style={{ color: "var(--muted)", margin: "0 auto 10px" }} />
                      <p className="text-sm" style={{ color: "var(--muted)" }}>{t("anl_no_activity")}</p>
                    </div>
                  </div>
                )
              }

              {topWords.length > 0
                ? <TopWordsRank topWords={topWords} />
                : (
                  <div className="card flex items-center justify-center" style={{ padding: 22, gridColumn: "span 4", minHeight: 200 }}>
                    <div className="text-center">
                      <BarChart2 size={28} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{t("anl_top_words")}</p>
                    </div>
                  </div>
                )
              }

              <MilestoneTrack totalWords={totalWords} done={doneSet} />

              {latestMilestone && (
                <>
                  <LatestReport milestone={latestMilestone} />
                  <PatternsCard milestone={latestMilestone} />
                </>
              )}
            </div>

            {(bestDay > 0 || paceWordsPerDay > 0) && (
              <div className="flex flex-wrap gap-2 mt-4 justify-end">
                {paceWordsPerDay > 0 && (
                  <span className="chip">
                    <TrendingUp size={11} />
                    {t("anl_pace", formatNumber(paceWordsPerDay, t))}
                  </span>
                )}
                {bestDay > 0 && (
                  <span className="chip">
                    <Star size={11} />
                    {t("anl_best_day", bestDay.toLocaleString())}
                  </span>
                )}
              </div>
            )}

            {milestones.length > 1 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={16} style={{ color: "var(--accent)" }} />
                  <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>{t("anl_past_reports")}</h2>
                  <span className="chip">{milestones.length - 1}</span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {[...milestones].slice(0, -1).reverse().map((m) => (
                    <PastReportCard key={m.id} milestone={m} />
                  ))}
                </div>
              </div>
            )}

            {milestones.length === 0 && loaded && totalWords > 0 && (
              <div className="card p-6 text-center mt-4" style={{ borderColor: "var(--accent-border)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}>
                  <Mic size={22} style={{ color: "var(--accent)" }} />
                </div>
                <p className="font-bold mb-1" style={{ color: "var(--text)" }}>{t("anl_start_h")}</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {t("anl_start_p", (next ?? 100).toLocaleString())}
                </p>
              </div>
            )}

            <div className="h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
