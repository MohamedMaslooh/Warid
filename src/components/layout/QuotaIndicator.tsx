// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSettingsStore } from "../../stores/settingsStore";
import { useRequestTrackerStore } from "../../stores/requestTrackerStore";
import { KNOWN_MODELS, AUTO_MODEL_ID, getAutoCandidates } from "../../lib/gemini";
import { useLang } from "../../lib/useLang";

export function QuotaIndicator({ modelId: propModelId }: { modelId?: string } = {}) {
  const { settings } = useSettingsStore();
  const { getRequestCountToday } = useRequestTrackerStore();
  const { t } = useLang();

  const selected = propModelId || settings.selectedModel;
  const isAuto = selected === AUTO_MODEL_ID;
  // In Auto mode, surface the model that will actually be used next (the first
  // candidate with quota remaining) so the badge stays accurate per-model.
  const modelId = isAuto ? (getAutoCandidates()[0] ?? selected) : selected;
  const model = KNOWN_MODELS.find((m) => m.id === modelId);
  if (!model) return null;

  let limit = 0;
  let hasLimit = false;
  if (model.quota.type === "free") {
    limit = model.quota.rpd;
    hasLimit = true;
  } else if (model.quota.type === "free_or_paid") {
    limit = model.quota.freeRpd;
    hasLimit = true;
  }

  const used = getRequestCountToday(modelId);
  const percentage = hasLimit ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;

  // Visual cues based on quota consumption
  let textColor = "var(--text-2)";
  let dotColor = "var(--success)";

  if (hasLimit) {
    if (percentage >= 80) {
      textColor = "var(--danger)";
      dotColor = "var(--danger)";
    } else if (percentage >= 50) {
      textColor = "var(--warning)";
      dotColor = "var(--warning)";
    }
  }

  return (
    <div
      className="hidden sm:flex items-center gap-2.5 px-3 py-1 text-xs font-semibold select-none border"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border)",
        color: "var(--text-2)",
        borderRadius: "999px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full relative flex">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ background: dotColor }}
        />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: dotColor }} />
      </span>
      <span className="truncate max-w-[160px] font-medium" style={{ color: "var(--text-2)" }}>
        {isAuto ? `${t("quota_auto")} · ${model.label}` : model.label}
      </span>
      {hasLimit && (
        <>
          <span className="h-3 w-[1px]" style={{ background: "var(--border)" }} />
          <span className="font-mono text-xs flex items-center gap-1" style={{ color: textColor }}>
            <span>{used}</span>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span style={{ color: "var(--muted)" }}>{limit}</span>
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>
              {t("quota_reqs")}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
