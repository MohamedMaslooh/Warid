import { useEffect, useState } from "react";
import { Cloud, Mail, KeyRound, LogOut, RefreshCw, ArrowUpCircle, Check } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLang } from "../../lib/useLang";
import { CLOUD_ENABLED, CLOUD_GATEWAY_URL } from "../../lib/cloudConfig";
import { sendLoginCode, verifyLoginCode, signOutCloud, refreshCloudAccount, getAccessToken } from "../../lib/cloudAuth";
import { createCheckout } from "../../lib/cloud";

/**
 * Warid Cloud account panel — shown at the top of Settings → Keys when the build
 * has the cloud tier enabled. Handles sign-in (email OTP code), the BYOK↔Cloud
 * engine toggle, the audio-minute balance, and upgrade checkout. Renders nothing
 * in public BYOK-only builds.
 */
export function CloudPanel() {
  const { settings, update } = useSettingsStore();
  const { t } = useLang();
  const signedIn = !!settings.cloudSessionToken;

  const [email, setEmail] = useState(settings.cloudEmail);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Refresh plan/balance whenever the panel opens while signed in.
  useEffect(() => { if (signedIn) void refreshCloudAccount(); }, [signedIn]);

  if (!CLOUD_ENABLED) return null;

  const handleSendCode = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await sendLoginCode(email.trim());
      setStage("code");
      setMsg(t("cloud_link_sent"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("cloud_signin_failed"));
    } finally { setBusy(false); }
  };

  const handleVerify = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await verifyLoginCode(email.trim(), code);
      setCode(""); setStage("email");
      await refreshCloudAccount();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("cloud_signin_failed"));
    } finally { setBusy(false); }
  };

  const handleUpgrade = async (plan: "plus" | "pro") => {
    setBusy(true); setErr(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t("err_cloud_signed_out"));
      const url = await createCheckout(token, CLOUD_GATEWAY_URL, plan);
      await openUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("cloud_signin_failed"));
    } finally { setBusy(false); }
  };

  const card = (children: React.ReactNode) => (
    <section
      className="space-y-3 p-4"
      style={{ border: "1px solid var(--accent-border)", borderRadius: 16, background: "var(--accent-soft)" }}
    >
      <div className="flex items-center gap-2">
        <Cloud size={18} strokeWidth={2} style={{ color: "var(--accent)" }} />
        <h2 className="font-bold text-sm" style={{ color: "var(--accent)" }}>{t("cloud_section")}</h2>
        <span className="text-xs" style={{ color: "var(--muted)" }}>— {t("cloud_tagline")}</span>
      </div>
      {children}
      {CLOUD_GATEWAY_URL && (
        <div className="flex gap-3 pt-1 text-xs" style={{ color: "var(--muted)" }}>
          <button type="button" onClick={() => void openUrl(`${CLOUD_GATEWAY_URL}/legal/privacy`)} className="underline">{t("cloud_privacy")}</button>
          <button type="button" onClick={() => void openUrl(`${CLOUD_GATEWAY_URL}/legal/terms`)} className="underline">{t("cloud_terms")}</button>
        </div>
      )}
    </section>
  );

  if (!signedIn) {
    return card(
      <div className="space-y-2.5">
        {stage === "email" ? (
          <>
            <label className="section-label" style={{ color: "var(--text-2)" }}>{t("cloud_signin")}</label>
            <div className="relative">
              <Mail size={16} className="absolute inset-y-0 left-0 my-auto ms-3" style={{ color: "var(--muted)" }} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t("cloud_email_ph")} className="input-base" style={{ paddingLeft: 38 }} dir="ltr"
              />
            </div>
            <button type="button" disabled={busy || !email.trim()} onClick={handleSendCode} className="btn-primary w-full justify-center">
              <Mail size={15} strokeWidth={2} /> {t("cloud_send_link")}
            </button>
          </>
        ) : (
          <>
            <label className="section-label" style={{ color: "var(--text-2)" }}>{email}</label>
            <div className="relative">
              <KeyRound size={16} className="absolute inset-y-0 left-0 my-auto ms-3" style={{ color: "var(--muted)" }} />
              <input
                type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="123456" className="input-base" style={{ paddingLeft: 38, letterSpacing: 4 }} dir="ltr" autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStage("email"); setErr(null); setMsg(null); }} className="btn-secondary">←</button>
              <button type="button" disabled={busy || code.trim().length < 6} onClick={handleVerify} className="btn-primary flex-1 justify-center">
                <Check size={15} strokeWidth={2} /> {t("cloud_signin")}
              </button>
            </div>
          </>
        )}
        {msg && <p className="text-xs" style={{ color: "var(--success)" }}>{msg}</p>}
        {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
      </div>,
    );
  }

  // Signed in
  const used = settings.cloudMinutesUsed;
  const limit = settings.cloudMinutesLimit;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const planLabel = settings.cloudPlan === "pro" ? "Pro" : settings.cloudPlan === "plus" ? "Plus" : "Free";

  return card(
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm" style={{ color: "var(--text)" }}>{t("cloud_signed_in_as", settings.cloudEmail)}</span>
        <button type="button" onClick={() => void signOutCloud()} className="btn-ghost text-xs">
          <LogOut size={13} strokeWidth={2} /> {t("cloud_signout")}
        </button>
      </div>

      {/* Engine toggle: BYOK vs Cloud */}
      <div>
        <label className="section-label" style={{ color: "var(--text-2)" }}>{t("cloud_engine")}</label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {(["byok", "cloud"] as const).map((mode) => {
            const active = settings.accountMode === mode;
            return (
              <button
                key={mode} type="button" onClick={() => void update({ accountMode: mode })}
                className="py-2 px-3 text-sm font-semibold transition-all"
                style={{
                  borderRadius: 12,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--surface)" : "transparent",
                  color: active ? "var(--accent)" : "var(--muted)",
                }}
              >
                {mode === "byok" ? t("cloud_engine_byok") : t("cloud_engine_cloud")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan + balance */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
          {t("cloud_plan")}: <span style={{ color: "var(--accent)" }}>{planLabel}</span>
        </span>
        <button type="button" onClick={() => void refreshCloudAccount()} className="btn-ghost text-xs">
          <RefreshCw size={12} strokeWidth={2} /> {t("cloud_refresh")}
        </button>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
          <div className="h-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--danger)" : "var(--accent)" }} />
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {t("cloud_balance_label")}: {t("cloud_minutes_left", used.toFixed(1), String(limit))}
        </p>
      </div>

      {/* Upgrade */}
      <div className="flex gap-2 pt-1">
        <button type="button" disabled={busy} onClick={() => void handleUpgrade("plus")} className="btn-secondary flex-1 justify-center text-xs">
          <ArrowUpCircle size={14} strokeWidth={2} /> Plus
        </button>
        <button type="button" disabled={busy} onClick={() => void handleUpgrade("pro")} className="btn-secondary flex-1 justify-center text-xs">
          <ArrowUpCircle size={14} strokeWidth={2} /> Pro
        </button>
      </div>
      {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>,
  );
}
