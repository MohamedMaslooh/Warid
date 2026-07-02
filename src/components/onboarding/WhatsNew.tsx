// SPDX-License-Identifier: AGPL-3.0-or-later

import { Mic, Pin, EyeOff, X, Sparkles, DownloadCloud } from "lucide-react";
import { useLang } from "../../lib/useLang";

interface Props {
  onDismiss: () => void;
}

export function WhatsNew({ onDismiss }: Props) {
  const { t, isRTL } = useLang();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-in"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
          />
          <div className="relative flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              <Sparkles size={16} strokeWidth={2} />
            </div>
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
              {t("wn_title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="relative p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "min(70vh, 560px)" }}>
          {/* New in 1.1.2 — in-app updates */}
          <FeatureCard
            icon={<DownloadCloud size={18} strokeWidth={1.75} />}
            title={t("wn_update_t")}
            body={t("wn_update_b")}
            accent
          />

          {/* New in 1.1.0 — floating recording capsule */}
          <FeatureCard
            icon={<Mic size={18} strokeWidth={1.75} />}
            title={t("wn_capsule_t")}
            body={t("wn_capsule_b")}
          />

          {/* Capsule sub-options */}
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard
              icon={<Pin size={15} strokeWidth={1.75} />}
              title={t("wn_capsule_always_t")}
              body={t("wn_capsule_always_b")}
            />
            <FeatureCard
              icon={<EyeOff size={15} strokeWidth={1.75} />}
              title={t("wn_capsule_off_t")}
              body={t("wn_capsule_off_b")}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onDismiss}
            className="btn-primary w-full"
            style={{ justifyContent: "center" }}
          >
            {t("wn_dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-xl space-y-2"
      style={{
        background: accent ? "var(--accent-soft)" : "var(--surface-2)",
        border: `1px solid ${accent ? "var(--accent-border)" : "var(--border)"}`,
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ color: accent ? "var(--accent)" : "var(--text-2)" }}
      >
        {icon}
        <p className="text-sm font-bold" style={{ color: accent ? "var(--accent)" : "var(--text)" }}>
          {title}
        </p>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
        {body}
      </p>
    </div>
  );
}
