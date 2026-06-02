import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Recorder } from "./components/recording/Recorder";
import { HistoryPage } from "./components/history/HistoryPage";
import { TemplatesPage } from "./components/templates/TemplatesPage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { LogsPage } from "./components/logs/LogsPage";
import { AnalyticsPage } from "./components/analytics/AnalyticsPage";
import { UploadPage } from "./components/recording/UploadPage";
import { Welcome } from "./components/onboarding/Welcome";
import { WhatsNew } from "./components/onboarding/WhatsNew";
import { useSettingsStore } from "./stores/settingsStore";
import { useTemplatesStore } from "./stores/templatesStore";
import { useRecordingStore } from "./stores/recordingStore";
import { showOverlay, hideOverlay, pushOverlayState } from "./lib/overlayWindow";
import { dispatchOverlayCommand, type OverlayCommand } from "./lib/overlayCommands";
import { listen } from "@tauri-apps/api/event";
import { ControlBar } from "./components/recording/ControlBar";
import { UpdateBanner } from "./components/layout/UpdateBanner";
import { MilestoneBanner } from "./components/layout/MilestoneBanner";
import { fetchLatestVersion, isNewer } from "./lib/updateCheck";
import { useAnalyticsStore } from "./stores/analyticsStore";
import { syncCancelHotkey } from "./lib/cancelHotkey";
import { reconcileLaunchOnStartup } from "./lib/autostart";
import { formatAccelerator } from "./lib/hotkey";
import { useLang } from "./lib/useLang";

export default function App() {
  const isOverlay = new URLSearchParams(window.location.search).has("overlay");
  const { load: loadSettings, settings, loaded, update } = useSettingsStore();
  const { load: loadTemplates, activeTemplateId, templates } = useTemplatesStore();
  const { celebrateMilestone, timeSavedMin, clearCelebrateMilestone } = useAnalyticsStore();
  const recState = useRecordingStore((s) => s.state);
  const { t } = useLang();
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      await loadSettings();
    })();
  }, []);

  // Check for a newer GitHub release once on startup
  useEffect(() => {
    if (isOverlay) return;
    (async () => {
      const current = await getVersion();
      const latest = await fetchLatestVersion();
      if (latest && isNewer(latest, current)) setUpdateVersion(latest);
    })();
  }, []);

  useEffect(() => {
    if (!loaded || isOverlay) return;

    (async () => {
      await loadTemplates(settings.defaultTemplateId);
    })();
  }, [loaded, settings.defaultTemplateId, loadTemplates, isOverlay]);

  useEffect(() => {
    if (!loaded || !templates.length || !activeTemplateId || settings.defaultTemplateId === activeTemplateId) return;
    update({ defaultTemplateId: activeTemplateId });
  }, [loaded, templates.length, activeTemplateId, settings.defaultTemplateId, update]);

  // Sync tray menu labels with the user's chosen UI language.
  useEffect(() => {
    if (!loaded || isOverlay) return;
    invoke("update_tray_language", { lang: settings.uiLanguage }).catch(() => {});
  }, [loaded, settings.uiLanguage, isOverlay]);

  // Register (or re-register) the global cancel hotkey whenever it changes.
  useEffect(() => {
    if (!loaded || isOverlay) return;
    void syncCancelHotkey(settings.cancelHotkey);
  }, [loaded, settings.cancelHotkey, isOverlay]);

  // One-time self-heal for the 1.0.1 autostart fix: re-apply the registry entry
  // for users who already had Launch on Startup enabled, so they don't have to
  // toggle it off and on manually.
  useEffect(() => {
    if (!loaded || isOverlay || settings.autostartHealed) return;
    (async () => {
      await reconcileLaunchOnStartup(settings.launchOnStartup);
      await update({ autostartHealed: true });
    })();
  }, [loaded, isOverlay, settings.autostartHealed, settings.launchOnStartup, update]);

  // Drive the floating overlay's idle baseline from the user's overlayMode.
  // Visibility *during* recording/processing is owned by the Recorder; here we
  // only enforce the resting state (always-visible launcher vs hidden) and
  // react instantly when the setting changes.
  useEffect(() => {
    if (isOverlay || !loaded) return;
    const active = recState === "recording" || recState === "processing";
    if (active) return;
    if (settings.overlayMode === "always") {
      void showOverlay();
      void pushOverlayState({ state: "idle", paused: false, duration: 0 });
    } else {
      void hideOverlay();
    }
  }, [isOverlay, loaded, settings.overlayMode, recState]);

  // Own the overlay command listeners at the always-mounted App level (not the
  // route-scoped Recorder) so the floating bar works from any screen. Commands
  // are dispatched into the persistent handler the Recorder registers.
  useEffect(() => {
    if (isOverlay) return;
    const cmds: OverlayCommand[] = ["start", "stop", "pause", "resume", "cancel"];
    const unlisten = cmds.map((c) => listen(`overlay:${c}`, () => dispatchOverlayCommand(c)));
    return () => { unlisten.forEach((p) => p.then((fn) => fn())); };
  }, [isOverlay]);

  // Apply theme
  useEffect(() => {
    const html = document.documentElement;
    if (settings.theme === "dark") {
      html.classList.add("dark");
    } else if (settings.theme === "light") {
      html.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      html.classList.toggle("dark", mq.matches);
      const listener = (e: MediaQueryListEvent) => html.classList.toggle("dark", e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [settings.theme]);

  if (isOverlay) {
    return (
      <div className={settings.theme === "dark" ? "dark" : ""}>
        <ControlBar />
      </div>
    );
  }

  // Show the full-page welcome flow on first launch, or whenever the user has
  // no API key yet (in that case we skip the language/theme step).
  const showWelcome =
    loaded && !welcomeDone && (settings.firstRun || !settings.apiKey);

  return (
    <BrowserRouter>
      <div
        className="h-screen flex overflow-hidden"
        style={{ background: "var(--bg)", color: "var(--text)" }}
        dir={settings.uiLanguage === "en" ? "ltr" : "rtl"}
      >
        {/* Floating toast stack — fixed top-center, above all content */}
        {!showWelcome && !isOverlay && (updateVersion && !updateDismissed || !!celebrateMilestone) && (
          <div
            className="fixed flex flex-col gap-2 z-50 items-center"
            style={{ top: 12, left: "50%", transform: "translateX(-50%)" }}
          >
            {updateVersion && !updateDismissed && (
              <UpdateBanner version={updateVersion} onDismiss={() => setUpdateDismissed(true)} />
            )}
            {celebrateMilestone && (
              <MilestoneBanner
                milestone={celebrateMilestone}
                timeSavedMin={timeSavedMin}
                onDismiss={clearCelebrateMilestone}
              />
            )}
          </div>
        )}
        {showWelcome ? (
          <Welcome
            startAtKey={!settings.firstRun}
            onComplete={() => setWelcomeDone(true)}
          />
        ) : (
          <>
            {loaded && !settings.seenWhatsNew111 && (
              <WhatsNew onDismiss={() => update({ seenWhatsNew111: true })} />
            )}
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
              {loaded && !settings.seenCancelHotkey && (
                <div
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm shrink-0"
                  style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--text-2)" }}>
                    {t("feat_cancel_tip", formatAccelerator(settings.cancelHotkey))}
                  </span>
                  <button
                    type="button"
                    onClick={() => update({ seenCancelHotkey: true })}
                    className="shrink-0 text-xs font-semibold px-3 py-0.5 rounded-full"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {t("feat_cancel_got_it")}
                  </button>
                </div>
              )}
              {loaded && settings.seenCancelHotkey && !settings.seenAutostartNotice && (
                <div
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm shrink-0"
                  style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--text-2)" }}>
                    {t("feat_autostart_fix")}
                  </span>
                  <button
                    type="button"
                    onClick={() => update({ seenAutostartNotice: true })}
                    className="shrink-0 text-xs font-semibold px-3 py-0.5 rounded-full"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {t("feat_cancel_got_it")}
                  </button>
                </div>
              )}
              <Routes>
                <Route path="/" element={<Recorder />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/logs" element={<LogsPage />} />
              </Routes>
            </main>
          </>
        )}
      </div>
    </BrowserRouter>
  );
}
