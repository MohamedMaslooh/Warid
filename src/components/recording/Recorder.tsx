import { useRef, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Mic, Square, RefreshCw, Copy, Terminal, Clock, Zap, Share2 } from "lucide-react";
import { formatDuration, playBeep } from "../../lib/audio";
import { recorder } from "../../lib/sharedRecorder";
import { abortSignal, clearAbortSignal } from "../../lib/recordingAbort";
import { doCancel } from "../../lib/cancelHotkey";
import { streamAudio, KNOWN_MODELS, AUTO_MODEL_ID } from "../../lib/gemini";
import { useRecordingStore } from "../../stores/recordingStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTemplatesStore } from "../../stores/templatesStore";
import { useLogStore, type LogEntry } from "../../stores/logStore";
import { useHistoryStore } from "../../stores/historyStore";
import { useAnalyticsStore } from "../../stores/analyticsStore";
import { saveHistory } from "../../lib/db";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";
import { setOverlayCommandHandler } from "../../lib/overlayCommands";
import { showOverlay, hideOverlay, pushOverlayState } from "../../lib/overlayWindow";
import { setCommandHotkeyHandler } from "../../lib/commandHotkeys";
import { formatAccelerator, normalizeAccelerator } from "../../lib/hotkey";
import { useLang } from "../../lib/useLang";
import type { Template, HistoryItem } from "../../types";
import { QuotaIndicator } from "../layout/QuotaIndicator";

/** Pick localised name for a template object */
function getTemplateName(tpl: { name: string; name_en?: string }, lang: string): string {
  return lang === "en" && tpl.name_en ? tpl.name_en : tpl.name;
}


export function Recorder() {
  const rs = useRecordingStore();
  const { refresh: refreshAnalytics } = useAnalyticsStore();
  const { settings } = useSettingsStore();
  const { active: getActive, templates, activeTemplateId, setActive } = useTemplatesStore();
  const { addLog } = useLogStore();
  const { t, lang } = useLang();
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const hotkeyRef = useRef(false);
  const recordingTemplateRef = useRef<Template | null>(null);
  const activeModelIdRef = useRef<string>(settings.selectedModel);

  useLayoutEffect(() => {
    const el = outputTextareaRef.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "0px";
      el.style.height = el.scrollHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [rs.output, rs.state]);

  const processAudio = useCallback(async (
    template: Template, base64: string, mimeType: string, durationMs: number,
  ) => {
    const modelId = template.model || settings.selectedModel;
    const modelEntry = KNOWN_MODELS.find((m) => m.id === modelId);
    activeModelIdRef.current = modelId;
    rs.setActiveModel(modelEntry?.label ?? (modelId === AUTO_MODEL_ID ? t("quota_auto") : modelId));
    addLog("info", t("log_msg_sending"), `template="${getTemplateName(template, lang)}" model=${modelEntry?.label ?? modelId}`);

    if (!settings.apiKey && !settings.openRouterApiKey) {
      rs.setError(t("rec_no_key"));
      rs.setState("error");
      return;
    }

    clearAbortSignal();
    rs.setOutput("");
    rs.setState("processing");
    const processingStart = Date.now();
    const overlayMode = useSettingsStore.getState().settings.overlayMode;
    // When recording ends: in "always" mode keep the pill on screen showing its
    // idle launcher; otherwise tuck it away.
    const settleOverlay = async () => {
      if (overlayMode === "always") {
        await pushOverlayState({ state: "idle", paused: false, duration: 0 });
      } else {
        await hideOverlay();
      }
    };
    if (overlayMode !== "off") {
      await showOverlay();
      await pushOverlayState({ state: "processing", paused: false, duration: 0 });
    }


    const MAX_ATTEMPTS = 3;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (abortSignal.current) return;

      try {
        if (attempt > 1) {
          addLog("warn", t("log_msg_retry", String(attempt), String(MAX_ATTEMPTS)));
          rs.setOutput("");
          await new Promise((r) => setTimeout(r, 1000));
          if (abortSignal.current) return;
        }

        let fullText = "";
        const iterator = streamAudio(settings, template, base64, mimeType, addLog, (usedModelId) => {
          // Auto mode resolves to a concrete model only once a request is
          // actually consumed — record it so history stores the real model.
          activeModelIdRef.current = usedModelId;
          rs.setActiveModel(KNOWN_MODELS.find((m) => m.id === usedModelId)?.label ?? usedModelId);
        });
        for await (const chunk of iterator) {
          if (abortSignal.current) break;
          rs.appendOutput(chunk);
          fullText += chunk;
        }
        if (abortSignal.current) return;
        const totalDurationMs = durationMs + (Date.now() - processingStart);
        rs.setTotalDurationMs(totalDurationMs);
        rs.setState("done");
        playBeep("done");
        addLog("success", t("log_msg_ready"), t("log_msg_char_count", String(fullText.length)));

        if (settings.autoCopy && fullText) {
          if (overlayMode !== "always") await hideOverlay();
          await writeText(fullText);
          addLog("success", t("log_msg_copied"));
          await new Promise((r) => setTimeout(r, 150));
          try {
            await invoke("paste_at_cursor");
            addLog("success", t("log_msg_pasted"));
          } catch (err) {
            addLog("warn", "paste_at_cursor failed", err instanceof Error ? err.message : String(err));
          }
        }

        if (settings.saveHistory && fullText) {
          await saveHistory({
            id: crypto.randomUUID(),
            created_at: Date.now(),
            template_id: template.id,
            template_snapshot: JSON.stringify(template),
            model: activeModelIdRef.current,
            audio_path: null,
            duration_ms: totalDurationMs,
            output_text: fullText,
            estimated_tokens: Math.floor(fullText.length / 4),
          });
          await useHistoryStore.getState().load();
          await refreshAnalytics(settings.apiKey || undefined);
        }

        await settleOverlay();
        return; // success — exit the retry loop
      } catch (err) {
        if (abortSignal.current) return;
        lastError = err instanceof Error ? err.message : String(err);
        addLog("warn", t("log_msg_retry_failed", String(attempt)), lastError);
      }
    }

    // All attempts exhausted
    if (lastError) {
      addLog("error", t("log_msg_failed"), lastError);
      rs.setError(lastError);
      rs.setState("error");
    }

    await settleOverlay();
  }, [settings, rs, addLog, t]);


  const handleToggle = useCallback(async (isHotkey = false, templateOverride?: Template) => {
    const state = useRecordingStore.getState().state;
    if (state === "recording") {
      playBeep("stop");
      rs.setState("processing");
      const result = await recorder.stop();
      rs.setLastResult(result);
      const template = recordingTemplateRef.current ?? getActive();
      if (!template) { rs.setError(t("rec_no_template")); rs.setState("error"); return; }
      await processAudio(template, result.base64, result.mimeType, result.durationMs);
    } else if (state === "idle" || state === "done" || state === "error") {
      const template = templateOverride ?? getActive();
      if (!template) { rs.setError(t("rec_no_template")); rs.setState("error"); return; }
      if (templateOverride && templateOverride.id !== activeTemplateId) setActive(templateOverride.id);
      recordingTemplateRef.current = template;
      hotkeyRef.current = isHotkey;
      rs.reset();
      rs.setState("recording");
      recorder.onDuration = (ms) => {
        rs.setDuration(ms);
        // Push straight from the recorder callback so the overlay timer keeps
        // ticking even when the Recorder route is unmounted (always-on launcher).
        if (useSettingsStore.getState().settings.overlayMode !== "off") {
          void pushOverlayState({ state: "recording", paused: useRecordingStore.getState().paused, duration: ms });
        }
      };
      try {
        await recorder.start(settings.audioDeviceId || undefined);
        playBeep("start");
        addLog("info", t("log_msg_mic_ready"));
        if (useSettingsStore.getState().settings.overlayMode !== "off") {
          await showOverlay();
          // Repeat state push after the overlay's webview is up so its listener
          // doesn't miss the initial transition (cheap, race-safe).
          await pushOverlayState({ state: "recording", paused: false, duration: 0 });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        rs.setError(t("rec_mic_error") + ": " + msg);
        rs.setState("error");
      }
    }
  }, [processAudio, rs, getActive, activeTemplateId, setActive, addLog, t, settings.audioDeviceId]);

  const handlePauseToggle = useCallback(() => {
    if (useRecordingStore.getState().state !== "recording") return;
    const nextPaused = !rs.paused;
    if (rs.paused) {
      recorder.resume();
      rs.setPaused(false);
    } else {
      recorder.pause();
      rs.setPaused(true);
    }
    if (useSettingsStore.getState().settings.overlayMode !== "off") {
      void pushOverlayState({ state: "recording", paused: nextPaused, duration: useRecordingStore.getState().duration });
    }
  }, [rs]);

  const handleAbortRecording = useCallback(() => { void doCancel(); }, []);

  const handleToggleRef = useRef(handleToggle);
  useEffect(() => { handleToggleRef.current = handleToggle; }, [handleToggle]);

  useEffect(() => {
    setCommandHotkeyHandler((accel) => {
      const norm = normalizeAccelerator(accel);
      const tpl = useTemplatesStore.getState().templates.find((tpl) => normalizeAccelerator(tpl.hotkey) === norm);
      if (tpl) handleToggleRef.current(true, tpl);
    });
  }, []);

  // Listen for commands dispatched from the overlay control bar
  const handlersRef = useRef({
    toggle: handleToggle,
    pause: handlePauseToggle,
    abort: handleAbortRecording,
  });
  handlersRef.current = { toggle: handleToggle, pause: handlePauseToggle, abort: handleAbortRecording };

  // Register a persistent handler (module scope, no cleanup) so overlay
  // commands work from any route — App owns the Tauri listeners and dispatches
  // here, even when the Recorder route is unmounted.
  useEffect(() => {
    setOverlayCommandHandler((cmd) => {
      if (cmd === "start" || cmd === "stop") handlersRef.current.toggle(false);
      else if (cmd === "pause" || cmd === "resume") handlersRef.current.pause();
      else if (cmd === "cancel") handlersRef.current.abort();
    });
  }, []);

  const handleCancel = useCallback(() => { void doCancel(); }, []);

  const handleRegenerate = useCallback(async () => {
    if (!rs.lastResult) return;
    const template = recordingTemplateRef.current ?? getActive();
    if (!template) return;
    rs.setOutput("");
    await processAudio(template, rs.lastResult.base64, rs.lastResult.mimeType, rs.lastResult.durationMs);
  }, [rs, processAudio, getActive]);

  const activeTemplate = getActive();
  const activeHotkey = formatAccelerator(activeTemplate?.hotkey);
  const activeModelId = rs.state === "processing" ? activeModelIdRef.current : (activeTemplate?.model || settings.selectedModel);

  return (
    <div className="flex flex-col h-full">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">{t("rec_title")}</h1>
          {activeHotkey && <span className="kbd" dir="ltr">{activeHotkey}</span>}
        </div>
        <div className="flex items-center gap-2">
          <QuotaIndicator modelId={activeModelId} />
          {rs.state === "processing" && (
            <button onClick={handleCancel} className="btn-danger">
              <Square size={14} fill="currentColor" /> {t("rec_cancel")}
            </button>
          )}
          {rs.state === "done" && rs.lastResult && (
            <button onClick={handleRegenerate} className="btn-secondary" style={{ padding: "7px 12px", fontSize: 12 }}>
              <RefreshCw size={14} strokeWidth={1.75} /> {t("rec_regenerate")}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <OutputHeader output={rs.output} state={rs.state} duration={rs.duration} />
          <StatsBanner />
          <div className="flex-1 overflow-y-auto flex flex-col">
            {rs.state === "error" && (
              <div className="p-6">
                <div className="p-4 text-sm" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 12 }}>
                  {rs.error}
                </div>
              </div>
            )}

            {rs.state === "done" && rs.output && (
              <div className="px-6 pt-6">
                <div className="p-4 mb-4" style={{ border: "2px solid var(--accent-border)", borderRadius: 16, background: "var(--surface)", boxShadow: "var(--shadow-accent)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--success)" }}>{t("rec_done")}</span>
                    </div>
                    <InlineCopyButton text={rs.output} label={t("rec_copy")} copiedLabel={t("rec_copied")} onCopy={() => addLog("success", t("rec_copied"))} />
                  </div>
                  <textarea
                    ref={outputTextareaRef}
                    value={rs.output}
                    onChange={(e) => rs.setOutput(e.target.value)}
                    dir="auto"
                    className="w-full bg-transparent border-0 outline-none focus:ring-0 resize-none leading-relaxed text-sm whitespace-pre-wrap font-sans"
                    style={{ color: "var(--text)", overflow: "hidden", boxSizing: "border-box", display: "block" }}
                  />
                  {(() => {
                    const wordCount = rs.output.split(/\s+/).filter(Boolean).length;
                    const minutes = (rs.totalDurationMs ?? 0) / 60000;
                    const wpm = minutes > 0 ? Math.round(wordCount / minutes) : null;
                    return wpm !== null ? (
                      <div className="mt-2 text-right">
                        <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                          {wpm} {lang === "ar" ? "ك/د" : "wpm"}
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            <RecentHistory />
          </div>
          {settings.logsEnabled && <InlineLogs />}
        </div>

        <div className="w-80 shrink-0 flex flex-col overflow-hidden" style={{ borderInlineStart: "1px solid var(--border)", background: "var(--surface)", backdropFilter: "blur(10px)" }}>
          <div className="p-5 flex flex-col items-center gap-4 relative overflow-hidden shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="absolute pointer-events-none" style={{ left: "50%", top: 0, transform: "translate(-50%, -30%)", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, var(--accent-soft), transparent 65%)", filter: "blur(8px)" }} />
            <p className="section-label self-start z-10">{t("rec_section")}</p>
            {rs.state === "processing" ? (
              <button onClick={handleCancel} className="relative z-10 flex flex-col items-center gap-2 transition-transform hover:scale-[1.02]">
                <div className="w-24 h-24 grid place-items-center text-white" style={{ borderRadius: "50%", background: "linear-gradient(135deg, var(--warning), #c97a04)", boxShadow: "0 14px 32px -10px rgba(217,119,6,.5)", border: "1px solid rgba(255,255,255,.15)" }}>
                  <Square size={32} fill="currentColor" />
                </div>
                <p className="text-sm font-bold" style={{ color: "var(--warning)" }}>{t("rec_processing")}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{t("rec_cancel_hint")}</p>
              </button>
            ) : (
              <button onClick={() => handleToggle()} className="relative z-10 flex flex-col items-center gap-3 transition-transform hover:scale-[1.02]">
                {rs.state === "recording" ? (
                  <>
                    <div className="relative">
                      <span className="warid-pulse" /><span className="warid-pulse" /><span className="warid-pulse" />
                      <div className="relative w-24 h-24 grid place-items-center text-white" style={{ borderRadius: "50%", background: "radial-gradient(circle at 30% 28%, var(--accent-2), var(--accent) 70%)", boxShadow: "var(--shadow-accent)", border: "1px solid rgba(255,255,255,.15)" }}>
                        <Square size={28} fill="currentColor" />
                      </div>
                    </div>
                    <span className="font-mono font-bold text-lg" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{formatDuration(rs.duration)}</span>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 grid place-items-center text-white" style={{ borderRadius: "50%", background: "radial-gradient(circle at 30% 28%, var(--accent-2), var(--accent) 70%)", boxShadow: "var(--shadow-accent)", border: "1px solid rgba(255,255,255,.15)" }}>
                      <Mic size={36} strokeWidth={1.75} />
                    </div>
                    <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{t("rec_click_record")}</p>
                    {activeHotkey && (
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {t("rec_or_use")} <span className="kbd" dir="ltr">{activeHotkey}</span>
                      </p>
                    )}
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-5 flex-1 min-h-0 flex flex-col">
            <p className="section-label mb-3 shrink-0">{t("rec_command")}</p>
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 -mx-1 px-1">
              {templates.filter((tpl) => tpl.is_upload_only !== 1).map((tpl) => {
                const hk = formatAccelerator(tpl.hotkey);
                const isActive = activeTemplateId === tpl.id;
                return (
                  <button key={tpl.id} onClick={() => setActive(tpl.id)} className="text-start p-3 transition-all" style={{ border: `1px solid ${isActive ? "var(--accent-border)" : "var(--border)"}`, background: isActive ? "var(--accent-soft)" : "var(--surface-2)", borderRadius: 12 }}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <p className="text-sm font-bold truncate" style={{ color: isActive ? "var(--accent)" : "var(--text)" }}>{getTemplateName(tpl, lang)}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hk && <span className="kbd" dir="ltr">{hk}</span>}
                        {isActive && <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />}
                      </div>
                    </div>
                    <p className="text-xs line-clamp-1 text-start" style={{ color: "var(--muted)" }}>{tpl.prompt_body}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <ShareButton />
        </div>
      </div>
    </div>
  );
}

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  info: "var(--muted)", warn: "var(--warning)", error: "var(--danger)", success: "var(--success)",
};

function fmtTs(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}

function InlineLogs() {
  const { entries, clear } = useLogStore();
  const { t } = useLang();
  const bottomRef = useRef<HTMLDivElement>(null);
  const recent = entries.slice(-50);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [recent.length]);
  return (
    <div className="shrink-0 h-64 flex flex-col p-6 pt-4 min-h-0" style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Terminal size={14} strokeWidth={1.75} style={{ color: "var(--muted)" }} />
          <span className="section-label">{t("log_section")}</span>
          <span className="chip font-mono" style={{ padding: "2px 8px" }}>{entries.length}</span>
        </div>
        {entries.length > 0 && <button onClick={clear} className="text-xs" style={{ color: "var(--muted)" }}>{t("log_clear")}</button>}
      </div>
      <div className="flex-1 min-h-[120px] overflow-y-auto p-3 font-mono text-xs leading-relaxed" dir="ltr" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, backdropFilter: "blur(10px)" }}>
        {recent.length === 0 ? (
          <div className="h-full flex items-center justify-center" style={{ color: "var(--muted)" }}>{t("log_empty")}</div>
        ) : (
          <>
            {recent.map((e) => (
              <div key={e.id} className="mb-0.5 break-all">
                <span style={{ color: "var(--muted)" }}>[{fmtTs(e.ts)}]</span>{" "}
                <span className="font-bold uppercase" style={{ color: LEVEL_COLOR[e.level] }}>{e.level.padEnd(7)}</span>
                <span style={{ color: "var(--text)" }}>{e.msg}</span>
                {e.detail && <span style={{ color: "var(--muted)" }}>{" "}→ {e.detail}</span>}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}

function RecentHistory() {
  const { items, load } = useHistoryStore();
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { load(); }, [load]);
  if (items.length === 0) {
    return <div className="px-6 pt-6 text-sm text-center" style={{ color: "var(--muted)" }}>{t("rec_empty")}</div>;
  }
  const locale = lang === "ar" ? "ar-SA" : "en-US";

  const groups: { date: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const dateKey = new Date(item.created_at).toLocaleDateString(locale);
    const last = groups[groups.length - 1];
    if (last && last.date === dateKey) last.items.push(item);
    else groups.push({ date: dateKey, items: [item] });
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.date} className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: "var(--muted)" }}>
            {group.date}
          </div>
          {group.items.map((item: HistoryItem) => {
            const template = item.template_snapshot ? (() => { try { return JSON.parse(item.template_snapshot); } catch { return null; } })() : null;
            const modelLabel = KNOWN_MODELS.find((m) => m.id === item.model)?.label ?? item.model;
            const d = new Date(item.created_at);
            const timeStr = `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
            const wordCount = item.output_text.split(/\s+/).filter(Boolean).length;
            const minutes = (item.duration_ms ?? 0) / 60000;
            const wpm = minutes > 0 ? Math.round(wordCount / minutes) : null;
            const isExpanded = expanded === item.id;
            const showShowAll = !isExpanded && item.output_text.length > 200;
            return (
              <div key={item.id} className="p-4" style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {template?.name && <span className="chip" style={{ fontSize: 11 }}>{getTemplateName(template, lang)}</span>}
                    <span className="chip font-mono" style={{ fontSize: 11 }}>{modelLabel}</span>
                    <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{timeStr}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <InlineCopyButton text={item.output_text} label={t("rec_copy")} copiedLabel={t("rec_copied")} />
                  </div>
                </div>
                <p className={`text-sm leading-relaxed cursor-pointer ${isExpanded ? "" : "line-clamp-3"}`} dir="auto" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }} onClick={() => setExpanded(isExpanded ? null : item.id)}>
                  {item.output_text}
                </p>
                {(showShowAll || wpm !== null) && (
                  <div className="flex items-center justify-between mt-1 gap-2">
                    {showShowAll ? (
                      <button className="text-xs" style={{ color: "var(--accent)" }} onClick={() => setExpanded(item.id)}>{t("rec_show_all")}</button>
                    ) : <span />}
                    {wpm !== null && (
                      <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                        {wpm} {lang === "ar" ? "ك/د" : "wpm"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StatsBanner() {
  const { totalWords, timeSavedMin, effectiveWpm, loaded, load } = useAnalyticsStore();
  const { settings } = useSettingsStore();
  const { t, lang } = useLang();
  useEffect(() => { if (!loaded) load(settings.apiKey || undefined); }, [loaded, load, settings.apiKey]);
  if (!loaded || totalWords === 0) return null;
  const savedText = timeSavedMin < 1 ? t("time_less_min") : timeSavedMin < 60 ? t("time_min", String(Math.round(timeSavedMin))) : t("time_hour", (timeSavedMin / 60).toFixed(1));
  return (
    <div className="flex items-center gap-4 px-5 py-2 shrink-0 text-xs" style={{ borderBottom: "1px solid var(--border)", background: "var(--accent-soft)" }}>
      <span className="flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
        <Clock size={12} strokeWidth={2} />
        <span><strong>{savedText}</strong>{lang === "ar" ? " وُفِّرت" : " saved"}</span>
      </span>
      <span style={{ color: "var(--border-2)" }}>|</span>
      <span className="flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
        <Zap size={12} strokeWidth={2} style={{ color: "var(--accent)" }} />
        <span>{lang === "ar" ? "سرعتك " : "Speed "}<strong style={{ color: "var(--accent)", fontFamily: '"Inter", system-ui' }}>{effectiveWpm}</strong>{lang === "ar" ? " ك/د" : " wpm"}</span>
      </span>
      <span style={{ color: "var(--border-2)" }}>|</span>
      <span style={{ color: "var(--text-2)" }}>
        <strong style={{ color: "var(--accent)", fontFamily: '"Inter", system-ui' }}>{totalWords.toLocaleString()}</strong>
        {lang === "ar" ? " كلمة" : " words"}
      </span>
    </div>
  );
}

const SHARE_URL = "https://mohamedmaslooh.github.io/Warid/";

function ShareButton() {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    await writeText(SHARE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: copied ? "var(--accent-soft)" : "var(--surface-2)",
          color: copied ? "var(--accent)" : "var(--text-2)",
        }}
      >
        <Share2 size={14} strokeWidth={2} />
        {copied
          ? (lang === "ar" ? "✓ تم النسخ!" : "✓ Copied!")
          : (lang === "ar" ? "شارك التطبيق مع أصدقائك" : "Share with your friends")}
      </button>
    </div>
  );
}

function InlineCopyButton({ text, label, copiedLabel, onCopy }: { text: string; label: string; copiedLabel: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    await writeText(text);
    if (onCopy) onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="chip chip-accent cursor-pointer hover:scale-105 transition-transform"
    >
      <Copy size={12} /> {copied ? copiedLabel : label}
    </button>
  );
}

function OutputHeader({ output, state }: { output: string; state: string; duration: number }) {
  const { settings } = useSettingsStore();
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const copyOutput = async () => {
    if (output) { await writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <div className="flex justify-between items-center px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", backdropFilter: "blur(10px)" }}>
      <div className="flex gap-2">
        <button onClick={copyOutput} disabled={!output} className="chip chip-accent disabled:opacity-40 cursor-pointer" style={{ padding: "5px 10px" }}>
          <Copy size={12} strokeWidth={2} />
          {copied ? t("rec_copied") : t("rec_copy")}
        </button>
      </div>
      <div className="flex gap-2 text-xs font-mono items-center" style={{ color: "var(--muted)" }}>
        {output && <span className="chip">~{Math.floor(output.length / 4)} tokens</span>}
        {settings.autoCopy && state === "done" && <span className="chip chip-success">{t("rec_copied")}</span>}
      </div>
    </div>
  );
}
