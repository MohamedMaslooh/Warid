// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Eye, EyeOff, Save, ChevronUp, ChevronDown, X, Plus, RotateCcw } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Settings } from "../../types";
import {
  KNOWN_MODELS,
  AUTO_MODEL_ID,
  AUTO_ELIGIBLE_MODELS,
  DEFAULT_AUTO_SEQUENCE,
  resolveAutoSequence,
  modelDailyLimit,
} from "../../lib/gemini";
import { useRequestTrackerStore } from "../../stores/requestTrackerStore";
import { Sparkles } from "lucide-react";
import { Select } from "../ui/Select";
import { HotkeyField } from "../ui/HotkeyField";
import { useLang } from "../../lib/useLang";
import { setLaunchOnStartup } from "../../lib/autostart";
import { useUpdateStore } from "../../stores/updateStore";
import { CloudPanel } from "./CloudPanel";

type Tab = "keys" | "models" | "prefs" | "about";

export function SettingsPage() {
  const { settings, update } = useSettingsStore();
  const { getRequestCountToday } = useRequestTrackerStore();
  const { phase: updPhase, check: checkUpdate } = useUpdateStore();
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<Tab>("keys");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showORKey, setShowORKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [openRouterApiKey, setOpenRouterApiKey] = useState(settings.openRouterApiKey);
  const [selectedModel, setSelectedModel] = useState(settings.selectedModel);
  // The Auto fallback chain, shown resolved (so an untouched setting displays
  // the built-in order) and saved back as [] whenever it still matches that
  // order — that way a future release's model list flows through untouched.
  const [autoChain, setAutoChain] = useState<string[]>(() => resolveAutoSequence(settings.autoSequence));
  const [autoCopy, setAutoCopy] = useState(settings.autoCopy);
  const [saveHistory, setSaveHistory] = useState(settings.saveHistory);
  const [logsEnabled, setLogsEnabled] = useState(settings.logsEnabled);
  const [theme, setTheme] = useState(settings.theme);
  const [uiLanguage, setUiLanguage] = useState(settings.uiLanguage);
  const [launchOnStartup, setLaunchOnStartupState] = useState(settings.launchOnStartup);
  const [cancelHotkey, setCancelHotkey] = useState<string | null>(settings.cancelHotkey || null);
  const [overlayMode, setOverlayMode] = useState(settings.overlayMode);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const isDefaultChain = autoChain.join() === DEFAULT_AUTO_SEQUENCE.join();
  /** [] means "follow the app's built-in order", so never persist a copy of it. */
  const chainToSave = isDefaultChain ? [] : autoChain;
  const excludedModels = AUTO_ELIGIBLE_MODELS.filter((id) => !autoChain.includes(id));

  const moveInChain = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= autoChain.length) return;
    const next = [...autoChain];
    [next[index], next[target]] = [next[target], next[index]];
    setAutoChain(next);
  };

  // Only "light up" the Save button when the form differs from saved settings.
  const isDirty =
    chainToSave.join() !== (settings.autoSequence ?? []).join() ||
    apiKey !== settings.apiKey ||
    openRouterApiKey !== settings.openRouterApiKey ||
    selectedModel !== settings.selectedModel ||
    autoCopy !== settings.autoCopy ||
    saveHistory !== settings.saveHistory ||
    logsEnabled !== settings.logsEnabled ||
    theme !== settings.theme ||
    uiLanguage !== settings.uiLanguage ||
    launchOnStartup !== settings.launchOnStartup ||
    (cancelHotkey ?? "") !== (settings.cancelHotkey || "");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    await setLaunchOnStartup(launchOnStartup).catch(() => {});
    await update({ apiKey, openRouterApiKey, selectedModel, autoSequence: chainToSave, autoCopy, saveHistory, logsEnabled, theme, uiLanguage, launchOnStartup, cancelHotkey: cancelHotkey ?? "" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sectionHeading = (text: string) => (
    <h2 className="section-label pb-2" style={{ borderBottom: "1px solid var(--border)" }}>{text}</h2>
  );

  const geminiModels = KNOWN_MODELS.filter((m) => m.provider === "gemini");
  const orModels = KNOWN_MODELS.filter((m) => m.provider === "openrouter");

  const QuotaBadge = ({ quota }: { quota: (typeof KNOWN_MODELS)[number]["quota"] }) => {
    if (quota.type === "paid") {
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>{t("set_quota_paid")}</span>;
    }
    if (quota.type === "free_or_paid") {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>
          {t("set_quota_free_or_paid", quota.freeRpd.toString(), quota.paidRpd.toLocaleString())}
        </span>
      );
    }
    return (
      <>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>{t("set_quota_free", quota.rpd.toString())}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--surface-3, var(--surface-2))", color: "var(--muted)" }}>{t("set_quota_rpm", quota.rpm.toString())}</span>
      </>
    );
  };

  // Per-model "used today / remaining" line. Reflects accurate consumption —
  // only requests the model actually received are counted.
  const UsageLine = ({ modelId }: { modelId: string }) => {
    const limit = modelDailyLimit(modelId);
    if (!isFinite(limit)) return null;
    const used = getRequestCountToday(modelId);
    const pct = Math.min(100, Math.max(0, (used / limit) * 100));
    const color = pct >= 80 ? "var(--danger)" : pct >= 50 ? "var(--warning)" : "var(--success)";
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-3, var(--border))" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--muted)" }}>{t("set_used_today", String(used), String(limit))}</span>
      </div>
    );
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "keys",   label: t("set_tab_keys") },
    { id: "models", label: t("set_tab_models") },
    { id: "prefs",  label: t("set_tab_prefs") },
    { id: "about",  label: t("set_tab_about") },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="page-header flex items-center justify-between">
        <h1 className="page-title">{t("set_title")}</h1>
        {activeTab !== "about" && (
          <button type="submit" form="settings-form" disabled={!isDirty} className="btn-primary" style={{ width: "auto" }}>
            <Save size={16} strokeWidth={1.75} />
            {saved ? t("set_saved") : t("set_save")}
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation */}
        <div className="w-48 shrink-0 p-4 flex flex-col gap-1 overflow-y-auto" style={{ borderInlineEnd: "1px solid var(--border)", background: "transparent" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="text-sm py-2 px-3 rounded-lg transition-colors font-medium text-start"
              style={{
                background: activeTab === tab.id ? "var(--surface-2)" : "transparent",
                color: activeTab === tab.id ? "var(--accent)" : "var(--muted)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <form id="settings-form" onSubmit={handleSave} className="max-w-xl mx-auto p-6 space-y-8">

        {/* Tab: API Keys */}
        {activeTab === "keys" && (
          <>
            <CloudPanel />
            <section className="space-y-3">
              {sectionHeading(t("set_gemini"))}
              <div className="space-y-1.5">
                <label className="section-label" style={{ color: "var(--text-2)" }}>{t("set_gemini_key")}</label>
                <div className="relative">
                  <input type={showGeminiKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..." className="input-base" style={{ paddingLeft: 40 }} dir="ltr" />
                  <button type="button" onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute inset-y-0 left-0 px-3 flex items-center" style={{ color: "var(--muted)" }}>
                    {showGeminiKey ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {t("set_gemini_free")}{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    aistudio.google.com
                  </a>
                </p>
              </div>
            </section>

            <section className="space-y-3">
              {sectionHeading(t("set_or"))}
              <div className="space-y-1.5">
                <label className="section-label" style={{ color: "var(--text-2)" }}>{t("set_or_key")}</label>
                <div className="relative">
                  <input type={showORKey ? "text" : "password"} value={openRouterApiKey} onChange={(e) => setOpenRouterApiKey(e.target.value)} placeholder="sk-or-..." className="input-base" style={{ paddingLeft: 40 }} dir="ltr" />
                  <button type="button" onClick={() => setShowORKey(!showORKey)} className="absolute inset-y-0 left-0 px-3 flex items-center" style={{ color: "var(--muted)" }}>
                    {showORKey ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {t("set_or_from")}{" "}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    openrouter.ai/keys
                  </a>
                </p>
              </div>
            </section>
          </>
        )}

        {/* Tab: Models */}
        {activeTab === "models" && (
          <>
            <section className="space-y-3">
              {sectionHeading(t("set_model"))}
              <p className="text-xs" style={{ color: "var(--muted)" }}>{t("set_model_hint")}</p>

              {/* Auto mode — rotates through free Google models with fallback */}
              <label className="flex items-start gap-3 p-3 cursor-pointer transition-colors" style={{ border: `1px solid ${selectedModel === AUTO_MODEL_ID ? "var(--accent-border)" : "var(--border)"}`, background: selectedModel === AUTO_MODEL_ID ? "var(--accent-soft)" : "var(--surface-2)", borderRadius: 10 }}>
                <input type="radio" name="selectedModel" value={AUTO_MODEL_ID} checked={selectedModel === AUTO_MODEL_ID} onChange={() => setSelectedModel(AUTO_MODEL_ID)} className="mt-1" style={{ accentColor: "var(--accent)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles size={15} strokeWidth={2} style={{ color: selectedModel === AUTO_MODEL_ID ? "var(--accent)" : "var(--text-2)" }} />
                    <p className="text-sm font-bold" style={{ color: selectedModel === AUTO_MODEL_ID ? "var(--accent)" : "var(--text)" }}>{t("set_auto_label")}</p>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t("set_auto_desc")}</p>
                  <p className="text-[10px] font-mono mt-1.5 truncate" style={{ color: "var(--muted)" }} dir="ltr">
                    {autoChain.map((id) => KNOWN_MODELS.find((m) => m.id === id)?.label ?? id).join(" → ")}
                  </p>
                </div>
              </label>

              {/* Auto chain editor — order and membership of the fallback chain */}
              <div className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="section-label" style={{ color: "var(--text-2)" }}>{t("set_auto_order")}</p>
                  <button
                    type="button"
                    onClick={() => setAutoChain([...DEFAULT_AUTO_SEQUENCE])}
                    disabled={isDefaultChain}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                    style={{ color: isDefaultChain ? "var(--muted)" : "var(--accent)", opacity: isDefaultChain ? 0.5 : 1 }}
                  >
                    <RotateCcw size={12} strokeWidth={1.75} />
                    {t("set_auto_reset")}
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{t("set_auto_order_hint")}</p>

                <div className="flex flex-col gap-1">
                  {autoChain.map((id, i) => {
                    const m = KNOWN_MODELS.find((x) => x.id === id);
                    const iconBtn = {
                      background: "transparent",
                      color: "var(--muted)",
                      borderRadius: 6,
                    } as const;
                    return (
                      <div key={id} className="flex items-center gap-2 p-2" style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
                        <span className="text-[10px] font-mono w-4 text-center shrink-0" style={{ color: "var(--muted)" }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{m?.label ?? id}</p>
                          <p className="text-[10px] font-mono truncate" style={{ color: "var(--muted)" }} dir="ltr">{id}</p>
                        </div>
                        <button type="button" title={t("set_auto_up")} aria-label={t("set_auto_up")} onClick={() => moveInChain(i, -1)} disabled={i === 0} className="p-1 shrink-0" style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }}>
                          <ChevronUp size={14} strokeWidth={2} />
                        </button>
                        <button type="button" title={t("set_auto_down")} aria-label={t("set_auto_down")} onClick={() => moveInChain(i, 1)} disabled={i === autoChain.length - 1} className="p-1 shrink-0" style={{ ...iconBtn, opacity: i === autoChain.length - 1 ? 0.3 : 1 }}>
                          <ChevronDown size={14} strokeWidth={2} />
                        </button>
                        <button type="button" title={t("set_auto_remove")} aria-label={t("set_auto_remove")} onClick={() => setAutoChain(autoChain.filter((x) => x !== id))} disabled={autoChain.length === 1} className="p-1 shrink-0" style={{ ...iconBtn, opacity: autoChain.length === 1 ? 0.3 : 1 }}>
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {excludedModels.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>{t("set_auto_excluded")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {excludedModels.map((id) => {
                        const label = KNOWN_MODELS.find((x) => x.id === id)?.label ?? id;
                        return (
                          <button
                            key={id}
                            type="button"
                            title={t("set_auto_add", label)}
                            onClick={() => setAutoChain([...autoChain, id])}
                            className="text-xs flex items-center gap-1 px-2 py-1 transition-colors"
                            style={{ border: "1px dashed var(--border)", borderRadius: 999, color: "var(--text-2)" }}
                          >
                            <Plus size={11} strokeWidth={2} />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {geminiModels.length > 0 && (
                <div className="space-y-1.5">
                  <label className="section-label" style={{ color: "var(--text-2)" }}>Google AI Studio</label>
                  <div className="flex flex-col gap-1.5">
                    {geminiModels.map((m) => (
                      <label key={m.id} className="flex items-center gap-3 p-3 cursor-pointer transition-colors" style={{ border: `1px solid ${selectedModel === m.id ? "var(--accent-border)" : "var(--border)"}`, background: selectedModel === m.id ? "var(--accent-soft)" : "var(--surface-2)", borderRadius: 10 }}>
                        <input type="radio" name="selectedModel" value={m.id} checked={selectedModel === m.id} onChange={() => setSelectedModel(m.id)} style={{ accentColor: "var(--accent)" }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold" style={{ color: selectedModel === m.id ? "var(--accent)" : "var(--text)" }}>{m.label}</p>
                            <QuotaBadge quota={m.quota} />
                          </div>
                          <p className="text-xs font-mono truncate" style={{ color: "var(--muted)" }}>{m.id}</p>
                          <UsageLine modelId={m.id} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {orModels.length > 0 && (
                <div className="space-y-1.5">
                  <label className="section-label" style={{ color: "var(--text-2)" }}>OpenRouter</label>
                  <div className="flex flex-col gap-1.5">
                    {orModels.map((m) => (
                      <label key={m.id} className="flex items-center gap-3 p-3 cursor-pointer transition-colors" style={{ border: `1px solid ${selectedModel === m.id ? "var(--accent-border)" : "var(--border)"}`, background: selectedModel === m.id ? "var(--accent-soft)" : "var(--surface-2)", borderRadius: 10 }}>
                        <input type="radio" name="selectedModel" value={m.id} checked={selectedModel === m.id} onChange={() => setSelectedModel(m.id)} style={{ accentColor: "var(--accent)" }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold" style={{ color: selectedModel === m.id ? "var(--accent)" : "var(--text)" }}>{m.label}</p>
                            <QuotaBadge quota={m.quota} />
                          </div>
                          <p className="text-xs font-mono truncate" style={{ color: "var(--muted)" }}>{m.id}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* Tab: Preferences */}
        {activeTab === "prefs" && (
          <>
            <section className="space-y-3">
              {sectionHeading(t("set_behavior"))}
              <label className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text)" }}>{t("set_autocopy")}</span>
                <input type="checkbox" checked={autoCopy} onChange={(e) => setAutoCopy(e.target.checked)} className="w-4 h-4" style={{ accentColor: "var(--accent)" }} />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text)" }}>{t("set_save_hist")}</span>
                <input type="checkbox" checked={saveHistory} onChange={(e) => setSaveHistory(e.target.checked)} className="w-4 h-4" style={{ accentColor: "var(--accent)" }} />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>{t("set_logs")}</span>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{t("set_logs_hint")}</p>
                </div>
                <input type="checkbox" checked={logsEnabled} onChange={(e) => setLogsEnabled(e.target.checked)} className="w-4 h-4" style={{ accentColor: "var(--accent)" }} />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>{t("set_launch_startup")}</span>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{t("set_launch_startup_hint")}</p>
                </div>
                <input type="checkbox" checked={launchOnStartup} onChange={(e) => setLaunchOnStartupState(e.target.checked)} className="w-4 h-4" style={{ accentColor: "var(--accent)" }} />
              </label>
              <div className="space-y-1">
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>{t("set_cancel_hotkey")}</span>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{t("set_cancel_hotkey_hint")}</p>
                </div>
                <HotkeyField value={cancelHotkey} onChange={setCancelHotkey} label={null} hint={null} />
              </div>
              <div className="space-y-1.5">
                <div>
                  <span className="text-sm" style={{ color: "var(--text)" }}>{t("set_overlay_label")}</span>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{t("set_overlay_hint")}</p>
                </div>
                <Select
                  value={overlayMode}
                  onChange={(v) => {
                    const next = v as Settings["overlayMode"];
                    setOverlayMode(next);
                    void update({ overlayMode: next });
                  }}
                  options={[
                    { value: "recording", label: t("set_overlay_recording") },
                    { value: "always",    label: t("set_overlay_always") },
                    { value: "off",       label: t("set_overlay_off") },
                  ]}
                />
              </div>
            </section>

            <section className="space-y-3">
              {sectionHeading(t("set_appearance"))}
              <Select
                value={theme}
                onChange={(v) => setTheme(v as typeof theme)}
                options={[
                  { value: "system", label: t("set_theme_auto") },
                  { value: "light",  label: t("set_theme_light") },
                  { value: "dark",   label: t("set_theme_dark") },
                ]}
              />
            </section>

            <section className="space-y-3">
              {sectionHeading(t("set_language"))}
              <Select
                value={uiLanguage}
                onChange={(v) => {
                  const next = v as "ar" | "en";
                  setUiLanguage(next);
                  void update({ uiLanguage: next });
                }}
                options={[
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                ]}
              />
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {uiLanguage === "ar" ? "تطبيق فوري، بدون حاجة للحفظ" : "Applied instantly, no save needed"}
              </p>
            </section>
          </>
        )}

        {/* Tab: About */}
        {activeTab === "about" && (
          <section className="space-y-6">
            {/* App identity */}
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-3xl font-bold" style={{ color: "var(--accent)" }}>Warid</p>
              <p className="text-xs text-center" style={{ color: "var(--muted)" }}>{t("set_about_desc")}</p>
            </div>

            {/* Developer info */}
            <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--muted)" }}>{t("set_about_version")}</span>
                <span className="text-sm font-mono" style={{ color: "var(--text)" }}>{appVersion ? `v${appVersion}` : "—"}</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--muted)" }}>{t("set_about_developer")}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Mohamed Maslooh</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--muted)" }}>{t("set_about_github")}</span>
                <a
                  href="https://github.com/mohamedmaslooh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                  style={{ color: "var(--accent)" }}
                >
                  github.com/mohamedmaslooh
                </a>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--muted)" }}>{t("set_about_website")}</span>
                <a
                  href="https://mohamedmaslooh.github.io/Warid/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                  style={{ color: "var(--accent)" }}
                >
                  mohamedmaslooh.github.io/Warid
                </a>
              </div>
            </div>

            {/* Updates */}
            <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {sectionHeading(t("settings_updates"))}
              <label className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm" style={{ color: "var(--text)" }}>{t("settings_auto_download")}</span>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{t("settings_auto_download_desc")}</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoDownloadUpdates}
                  onChange={(e) => void update({ autoDownloadUpdates: e.target.checked })}
                  className="w-4 h-4 shrink-0"
                  style={{ accentColor: "var(--accent)" }}
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {updPhase === "checking"
                    ? t("upd_checking")
                    : updPhase === "uptodate"
                      ? t("upd_uptodate")
                      : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void checkUpdate(settings.autoDownloadUpdates)}
                  disabled={updPhase === "checking" || updPhase === "downloading"}
                  className="btn-secondary shrink-0"
                  style={{ width: "auto" }}
                >
                  {t("settings_check_updates")}
                </button>
              </div>
            </div>
          </section>
        )}
      </form>
        </div>
      </div>
    </div>
  );
}
