// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Check,
  Monitor,
  Sun,
  Moon,
  Mic,
  XCircle,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLang } from "../../lib/useLang";
import { formatAccelerator } from "../../lib/hotkey";
import { Select } from "../ui/Select";
import type { Lang } from "../../lib/i18n";
import type { Settings } from "../../types";
import { CLOUD_ENABLED } from "../../lib/cloudConfig";

interface Props {
  /** When true, skip the preferences step (used when the user already finished firstRun
   *  but cleared their API key). */
  startAtKey?: boolean;
  onComplete: () => void;
}

const AI_STUDIO_URL = "https://aistudio.google.com/apikey";

const SPLASH_WORDS = [
  "مرحباً",
  "Welcome",
  "Bienvenido",
  "ようこそ",
  "欢迎",
  "Bienvenue",
  "Willkommen",
  "Benvenuto",
  "स्वागत है",
  "Добро пожаловать",
  "Hoş geldiniz",
  "خوش آمدید",
];

export function Welcome({ startAtKey = false, onComplete }: Props) {
  const { settings, update } = useSettingsStore();
  const { t, isRTL } = useLang();
  const [step, setStep] = useState<0 | 1>(startAtKey ? 1 : 0);
  const [apiKey, setApiKey] = useState("");

  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);
  const [splashIdx, setSplashIdx] = useState(0);

  useEffect(() => {
    if (!showSplash) return;
    if (splashIdx < SPLASH_WORDS.length - 1) {
      const timer = setTimeout(() => {
        setSplashIdx((prev) => prev + 1);
      }, 220);
      return () => clearTimeout(timer);
    } else {
      const fadeTimer = setTimeout(() => {
        setFadeSplash(true);
      }, 400);
      const hideTimer = setTimeout(() => {
        setShowSplash(false);
      }, 700);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [splashIdx, showSplash]);

  const ArrowNext = isRTL ? ArrowLeft : ArrowRight;
  const ArrowPrev = isRTL ? ArrowRight : ArrowLeft;

  const goNext = async () => {
    if (settings.firstRun) await update({ firstRun: false });
    setStep(1);
  };

  const finish = async (saveKey: boolean) => {
    const patch: Partial<Settings> = { firstRun: false, seenCancelHotkey: true };
    if (saveKey && apiKey.trim()) patch.apiKey = apiKey.trim();
    await update(patch);
    onComplete();
  };

  const handleOpenStudio = async () => {
    try {
      await openUrl(AI_STUDIO_URL);
    } catch (err) {
      console.error("openUrl failed:", err);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {showSplash && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center z-50 select-none overflow-hidden transition-all duration-300"
          style={{
            background: "var(--bg)",
            opacity: fadeSplash ? 0 : 1,
            transform: fadeSplash ? "scale(1.02)" : "scale(1)",
            pointerEvents: "none",
          }}
        >
          {/* Animated decorative blur blobs in the background */}
          <div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full mix-blend-screen filter blur-[100px] opacity-15 animate-blob pointer-events-none"
            style={{ background: "var(--accent)", animationDelay: "0s" }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full mix-blend-screen filter blur-[100px] opacity-15 animate-blob pointer-events-none"
            style={{ background: "var(--accent-2)", animationDelay: "2s" }}
          />

          <div className="flex flex-col items-center gap-6 text-center px-6 relative z-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white relative animate-pulse"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                boxShadow: "0 8px 24px var(--accent-soft)",
              }}
            >
              <Sparkles size={32} strokeWidth={2} />
            </div>

            <div className="w-full flex items-center justify-center py-6 overflow-visible">
              <span
                key={splashIdx}
                className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent animate-fade-in py-4 px-6 leading-relaxed overflow-visible text-center"
                style={{
                  fontFamily: (splashIdx === 0 || splashIdx === 11) ? '"Noto Kufi Arabic", sans-serif' : '"Outfit", "Inter", sans-serif',
                }}
              >
                {SPLASH_WORDS[splashIdx]}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top accent strip */}
      <div
        className="flex-shrink-0"
        style={{
          height: 4,
          background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
        }}
      />

      {/* Global Header with Language Switcher */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
              boxShadow: "0 4px 12px var(--accent-soft)",
            }}
          >
            <Sparkles size={18} strokeWidth={2} />
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ color: "var(--text)" }}>
            {t("app_name")}
          </span>
        </div>

        {/* Global Language Toggle */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => update({ uiLanguage: "en" })}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95"
            style={{
              background: settings.uiLanguage === "en" ? "var(--surface)" : "transparent",
              color: settings.uiLanguage === "en" ? "var(--accent)" : "var(--muted)",
              boxShadow: settings.uiLanguage === "en" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              fontWeight: settings.uiLanguage === "en" ? 700 : 500,
            }}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => update({ uiLanguage: "ar" })}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95"
            style={{
              background: settings.uiLanguage === "ar" ? "var(--surface)" : "transparent",
              color: settings.uiLanguage === "ar" ? "var(--accent)" : "var(--muted)",
              boxShadow: settings.uiLanguage === "ar" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              fontWeight: settings.uiLanguage === "ar" ? 700 : 500,
            }}
          >
            AR
          </button>
        </div>
      </div>

      {/* Body — fills remaining space, never scrolls */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-8 py-4">
        <div className="w-full max-w-3xl">
          {step === 0 ? (
            <PreferencesStep
              t={t}
              lang={settings.uiLanguage}
              theme={settings.theme}
              audioDeviceId={settings.audioDeviceId}
              cancelHotkey={settings.cancelHotkey}
              onPickLang={(l) => update({ uiLanguage: l })}
              onPickTheme={(th) => update({ theme: th })}
              onPickMic={(id) => update({ audioDeviceId: id })}
              onNext={goNext}
              ArrowNext={ArrowNext}
              isRTL={isRTL}
            />
          ) : (
            <ApiKeyStep
              t={t}
              apiKey={apiKey}
              setApiKey={setApiKey}
              onBack={startAtKey ? null : () => setStep(0)}
              onSkip={() => finish(false)}
              onSave={() => finish(true)}
              onOpenStudio={handleOpenStudio}
              ArrowPrev={ArrowPrev}
            />
          )}
        </div>
      </div>

      {/* Footer step indicator */}
      {!startAtKey && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-2 py-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <StepDot active={step === 0} done={step > 0} />
          <StepDot active={step === 1} done={false} />
        </div>
      )}
    </div>
  );
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  const color = done ? "var(--success)" : active ? "var(--accent)" : "var(--border)";
  return (
    <div
      style={{
        width: active ? 22 : 8,
        height: 8,
        borderRadius: 999,
        background: color,
        transition: "width .2s ease",
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Step 0 — preferences (language + theme + mic)                    */
/* ──────────────────────────────────────────────────────────────── */

interface PreferencesProps {
  t: (key: any, ...args: string[]) => string;
  lang: Lang;
  theme: Settings["theme"];
  audioDeviceId: string;
  cancelHotkey: string;
  onPickLang: (l: Lang) => void;
  onPickTheme: (t: Settings["theme"]) => void;
  onPickMic: (id: string) => void;
  onNext: () => void;
  ArrowNext: typeof ArrowRight;
  isRTL: boolean;
}

function PreferencesStep({
  t,
  lang,
  theme,
  audioDeviceId,
  cancelHotkey,
  onPickLang,
  onPickTheme,
  onPickMic,
  onNext,
  ArrowNext,
  isRTL,
}: PreferencesProps) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--text)" }}>
          {t("ob_title")}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-2)" }}>
          {t("ob_sub")}
        </p>
      </div>

      {/* About — single premium card */}
      <div
        className="p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--surface), var(--surface-2))",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="absolute -right-10 -top-10 w-32 h-32 rounded-full pointer-events-none filter blur-2xl opacity-10"
          style={{ background: "var(--accent)" }}
        />
        <h2 className="text-sm font-bold mb-1.5 flex items-center gap-2" style={{ color: "var(--text)" }}>
          <Sparkles size={16} className="text-[var(--accent)] animate-pulse" />
          {t("ob_about_t")}
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
          {t("ob_about_b")}
        </p>
      </div>

      {/* Two-column: language + theme */}
      <div className="grid grid-cols-5 gap-4">
        {/* Language */}
        <div className="col-span-2 space-y-2">
          <Label icon={null}>{t("ob_pick_lang")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <SegmentCard
              selected={lang === "ar"}
              onClick={() => onPickLang("ar")}
              title="العربية"
              subtitle="AR"
            />
            <SegmentCard
              selected={lang === "en"}
              onClick={() => onPickLang("en")}
              title="English"
              subtitle="EN"
            />
          </div>
        </div>

        {/* Theme */}
        <div className="col-span-3 space-y-2">
          <Label icon={null}>{t("ob_pick_theme")}</Label>
          <div className="grid grid-cols-3 gap-2">
            <ThemeCard
              selected={theme === "system"}
              onClick={() => onPickTheme("system")}
              icon={<Monitor size={16} strokeWidth={2} />}
              title={t("set_theme_auto")}
            />
            <ThemeCard
              selected={theme === "light"}
              onClick={() => onPickTheme("light")}
              icon={<Sun size={16} strokeWidth={2} />}
              title={t("set_theme_light")}
            />
            <ThemeCard
              selected={theme === "dark"}
              onClick={() => onPickTheme("dark")}
              icon={<Moon size={16} strokeWidth={2} />}
              title={t("set_theme_dark")}
            />
          </div>
        </div>
      </div>

      {/* Microphone picker */}
      <div className="space-y-2">
        <Label icon={<Mic size={13} strokeWidth={2} />}>{t("ob_pick_mic")}</Label>
        <MicrophonePicker
          t={t}
          value={audioDeviceId}
          onChange={onPickMic}
          isRTL={isRTL}
        />
      </div>

      {/* Cancel shortcut tip */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <XCircle size={16} strokeWidth={1.75} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <p className="text-xs" style={{ color: "var(--text-2)" }}>
          {t("ob_cancel_tip", formatAccelerator(cancelHotkey))}
        </p>
      </div>

      {/* Continue */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onNext}
          className="btn-primary"
          style={{ padding: "10px 24px", fontSize: 14 }}
        >
          {t("ob_next")}
          <ArrowNext size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function Label({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon && <span style={{ color: "var(--text-2)" }}>{icon}</span>}
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
        {children}
      </p>
    </div>
  );
}

function SegmentCard({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95"
      style={{
        padding: "12px 8px",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        background: selected ? "var(--accent-soft)" : "var(--surface)",
        borderRadius: 12,
        boxShadow: selected ? "0 0 0 3px var(--accent-soft), var(--shadow-card)" : "none",
        minHeight: 52,
      }}
    >
      <span
        className="font-bold text-sm"
        style={{ color: selected ? "var(--accent)" : "var(--text)" }}
      >
        {title}
      </span>
      <span
        className="text-[10px] uppercase tracking-wider font-bold"
        style={{
          color: selected ? "var(--accent)" : "var(--muted)",
          opacity: 0.8,
        }}
      >
        {subtitle}
      </span>
    </button>
  );
}

function ThemeCard({
  selected,
  onClick,
  icon,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 transition-all duration-200 active:scale-95"
      style={{
        padding: "12px 6px",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        background: selected ? "var(--accent-soft)" : "var(--surface)",
        borderRadius: 12,
        boxShadow: selected ? "0 0 0 3px var(--accent-soft), var(--shadow-card)" : "none",
        minHeight: 52,
        color: selected ? "var(--accent)" : "var(--text-2)",
      }}
    >
      <span className="transition-transform duration-200 scale-110">{icon}</span>
      <span
        className="font-semibold text-[11px]"
        style={{ color: selected ? "var(--accent)" : "var(--text)" }}
      >
        {title}
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Microphone picker                                                */
/* ──────────────────────────────────────────────────────────────── */

interface MicPickerProps {
  t: (key: any, ...args: string[]) => string;
  value: string;
  onChange: (id: string) => void;
  isRTL: boolean;
}

function MicrophonePicker({ t, value, onChange, isRTL }: MicPickerProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [needsGrant, setNeedsGrant] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const mics = list.filter((d) => d.kind === "audioinput");
      setDevices(mics);
      // Labels are empty when permission hasn't been granted yet
      setNeedsGrant(mics.length > 0 && mics.every((d) => !d.label));
    } catch {
      setDevices([]);
      setNeedsGrant(true);
    }
  }, []);

  const grant = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
      await refresh();
    } catch (err) {
      console.error("Mic permission denied:", err);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    navigator.mediaDevices.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", handler);
  }, [refresh]);

  const options = [
    { value: "", label: t("ob_mic_default") },
    ...devices.map((d, i) => ({
      value: d.deviceId,
      label: d.label || `Microphone ${i + 1}`,
    })),
  ];

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1">
        <Select
          value={value}
          onChange={onChange}
          options={options}
          dir={isRTL ? "rtl" : "ltr"}
        />
      </div>
      {needsGrant && (
        <button
          type="button"
          onClick={grant}
          className="btn-ghost text-xs flex-shrink-0"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            paddingInline: 12,
          }}
        >
          <Mic size={13} strokeWidth={2} />
          {t("ob_mic_grant")}
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Step 1 — API key                                                 */
/* ──────────────────────────────────────────────────────────────── */

interface ApiKeyProps {
  t: (key: any, ...args: string[]) => string;
  apiKey: string;
  setApiKey: (v: string) => void;
  onBack: (() => void) | null;
  onSkip: () => void;
  onSave: () => void;
  onOpenStudio: () => void;
  ArrowPrev: typeof ArrowLeft;
}

function ApiKeyStep({
  t,
  apiKey,
  setApiKey,
  onBack,
  onSkip,
  onSave,
  onOpenStudio,
  ArrowPrev,
}: ApiKeyProps) {
  const hasKey = apiKey.trim().length > 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back row */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="btn-ghost text-xs group"
            style={{ padding: "4px 8px" }}
          >
            <ArrowPrev size={13} strokeWidth={2} className="transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
            {t("ob_back")}
          </button>
        </div>
      )}

      {/* Hero — vertical label-free */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--text)" }}>
          {t("ob_key_step_t")}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          {t("ob_key_step_b")}
        </p>
      </div>

      {/* Three steps — horizontal row */}
      <div className="grid grid-cols-3 gap-3">
        <StepCard n={1} title={t("ob_step1_t")} body={t("ob_step1_b")} />
        <StepCard n={2} title={t("ob_step2_t")} body={t("ob_step2_b")} />
        <StepCard n={3} title={t("ob_step3_t")} body={t("ob_step3_b")} />
      </div>

      {/* Open AI Studio button */}
      <button
        type="button"
        onClick={onOpenStudio}
        className="w-full flex items-center justify-center gap-2.5 transition-all duration-200 hover:border-[var(--accent-border)] hover:bg-[var(--surface-2)] active:scale-[0.99]"
        style={{
          padding: "12px 18px",
          background: "linear-gradient(135deg, var(--surface), var(--surface-2))",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <ExternalLink size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
        <span>{t("ob_open_studio")}</span>
        <span
          className="text-[10px] px-2 py-0.5 font-bold tracking-wide"
          style={{
            background: "var(--success-bg)",
            color: "var(--success)",
            borderRadius: 999,
          }}
        >
          {t("ob_free_badge")}
        </span>
      </button>

      {/* Key input */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
          {t("ob_key_label")}
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("ob_key_ph")}
          className="input-base w-full"
          style={{ padding: "12px 16px", minHeight: 48 }}
          dir="ltr"
          autoFocus
        />
        <div
          className="flex items-start gap-1.5 text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          <ShieldCheck size={11} strokeWidth={2} className="flex-shrink-0 mt-px" />
          <span>{t("ob_key_hint")}</span>
        </div>
      </div>

      {/* Warid Cloud — no key needed (cloud builds only). Finish onboarding, then
          sign in from Settings → Keys. */}
      {CLOUD_ENABLED && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:scale-[1.01]"
          style={{ padding: "10px 16px", border: "1px solid var(--accent-border)", background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 12 }}
        >
          ☁ {t("cloud_signin")} — {t("cloud_tagline")}
        </button>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button type="button" onClick={onSkip} className="btn-ghost text-xs">
          {t("ob_skip")}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!hasKey}
          className="btn-primary"
          style={{ padding: "10px 22px", fontSize: 14 }}
        >
          <Check size={15} strokeWidth={2} />
          {t("ob_start")}
        </button>
      </div>
    </div>
  );
}

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div
      className="p-4 flex flex-col gap-2.5 transition-all duration-300 relative group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 grid place-items-center flex-shrink-0 text-xs font-bold transition-all duration-300 group-hover:scale-110"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
            color: "white",
            borderRadius: "50%",
            fontFamily: '"Inter", sans-serif',
            boxShadow: "0 2px 8px var(--accent-soft)",
          }}
        >
          {n}
        </div>
        <p className="font-bold text-xs" style={{ color: "var(--text)" }}>
          {title}
        </p>
      </div>
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "var(--text-2)" }}
      >
        {body}
      </p>
    </div>
  );
}
