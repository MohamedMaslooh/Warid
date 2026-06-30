import { useRef, useEffect, useState } from "react";
import { 
  Upload, 
  Trash2, 
  Play, 
  Square, 
  Copy, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  X,
  FileAudio,
  FileVideo,
  Plus
} from "lucide-react";
import { 
  decodeAudioFromFile, 
  downsampleToMono16kHz, 
  segmentAudioBuffer, 
  blobToBase64 
} from "../../lib/fileTranscriber";
import { streamAudio, KNOWN_MODELS } from "../../lib/gemini";
import { exportToPDF } from "../../lib/pdfExporter";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTemplatesStore } from "../../stores/templatesStore";
import { useLogStore } from "../../stores/logStore";
import { useAnalyticsStore } from "../../stores/analyticsStore";
import { saveHistory } from "../../lib/db";
import { useLang } from "../../lib/useLang";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { QuotaIndicator } from "../layout/QuotaIndicator";
import { Select } from "../ui/Select";
import { useUploadQueueStore, type QueueItem } from "../../stores/uploadQueueStore";

export function UploadPage() {
  const { settings } = useSettingsStore();
  const { templates } = useTemplatesStore();
  const { addLog } = useLogStore();
  const { refresh: refreshAnalytics } = useAnalyticsStore();
  const { t, lang } = useLang();

  // Queue state from Zustand store
  const {
    queue,
    selectedItemId,
    isProcessing,
    selectedTemplateId,
    splitInterval,
    copiedId,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setSelectedItemId,
    setIsProcessing,
    setSelectedTemplateId,
    setSplitInterval,
    setCopiedId,
    updateItemText,
    updateItemStatus,
  } = useUploadQueueStore();

  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProcessRef = useRef<{ cancel: () => void } | null>(null);
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Set default template once loaded — choose lecture_transcription if available
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const lectureTpl = templates.find((t) => t.id === "lecture_transcription");
      const def = lectureTpl || templates.find((t) => t.is_default) || templates[0];
      setSelectedTemplateId(def.id);
    }
  }, [templates, selectedTemplateId, setSelectedTemplateId]);

  // Clean up active processing on unmount
  useEffect(() => {
    return () => {
      if (activeProcessRef.current) {
        activeProcessRef.current.cancel();
      }
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFilesAdded = (files: FileList) => {
    const newItems: QueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/") || 
                      file.name.endsWith(".mp3") || 
                      file.name.endsWith(".wav") || 
                      file.name.endsWith(".m4a") || 
                      file.name.endsWith(".wma") || 
                      file.name.endsWith(".flac") || 
                      file.name.endsWith(".ogg") ||
                      file.name.endsWith(".webm") || 
                      file.name.endsWith(".mp4");

      if (isAudio || isVideo) {
        newItems.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          type: isVideo ? "video" : "audio",
          size: file.size,
          status: "pending",
          progressPercent: 0,
          segmentInfo: "",
          outputText: "",
        });
      }
    }

    if (newItems.length > 0) {
      addToQueue(newItems);
      addLog("info", `[Queue] Added ${newItems.length} files to queue.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesAdded(e.target.files);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Helper to format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleCopy = async (id: string, text: string) => {
    if (!text) return;
    await writeText(text);
    setCopiedId(id);
    addLog("success", t("rec_copied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportPDF = async (name: string, text: string) => {
    if (!text) return;
    await exportToPDF(name, text);
  };

  const cancelProcessing = () => {
    if (activeProcessRef.current) {
      activeProcessRef.current.cancel();
    }
  };

  // Process the queue sequentially
  const startProcessing = async () => {
    if (isProcessing || queue.length === 0) return;

    const pendingItems = queue.filter(
      (item) => item.status === "pending" || item.status === "failed" || item.status === "cancelled"
    );
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    isProcessingRef.current = true;
    addLog("info", `[Queue] Starting batch transcription of ${pendingItems.length} files.`);

    const template = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    if (!template) {
      addLog("error", "[Queue] No transcription template found. Please create one first.");
      setIsProcessing(false);
      isProcessingRef.current = false;
      return;
    }

    for (const item of pendingItems) {
      // Re-read mutable isProcessing ref to see if user clicked cancel
      if (!isProcessingRef.current) break;

      let isAborted = false;
      const segmentGeneratorControllers: (() => void)[] = [];

      const abortHandler = () => {
        isAborted = true;
        segmentGeneratorControllers.forEach((c) => c());
      };

      activeProcessRef.current = { cancel: abortHandler };
      setSelectedItemId(item.id);

      try {
        // Step 1: Decoding audio
        updateItemStatus(item.id, { 
          status: "decoding", 
          progressPercent: 10,
          error: undefined
        });
        addLog("info", `[Queue] Decoding audio from: ${item.name}`);

        if (isAborted) throw new Error("cancelled");
        const audioBuffer = await decodeAudioFromFile(item.file);

        // Step 2: Downsampling
        if (isAborted) throw new Error("cancelled");
        updateItemStatus(item.id, { status: "decoding", progressPercent: 30 });
        addLog("info", `[Queue] Downsampling audio to 16kHz mono: ${item.name}`);
        const downsampledBuffer = await downsampleToMono16kHz(audioBuffer);

        // Step 3: Segmenting
        if (isAborted) throw new Error("cancelled");
        updateItemStatus(item.id, { status: "decoding", progressPercent: 40 });
        const durationSec = audioBuffer.duration;
        const durationMs = Math.round(durationSec * 1000);
        
        // Chunk duration in seconds
        const segmentDurationSec = splitInterval * 60;
        addLog("info", `[Queue] Slicing file into ${splitInterval}-minute segments. Total duration: ${(durationSec / 60).toFixed(2)} mins.`);
        const segments = segmentAudioBuffer(downsampledBuffer, segmentDurationSec);
        
        // Clear previous text
        updateItemText(item.id, "", false);
        updateItemStatus(item.id, { 
          status: "transcribing", 
          progressPercent: 50,
          durationMs
        });

        // Step 4: Transcribe segments sequentially
        let completeTranscriptText = "";
        // Track the model actually used (Auto mode resolves to a concrete model).
        let usedModelId = template.model || settings.selectedModel;

        for (let s = 0; s < segments.length; s++) {
          if (isAborted) throw new Error("cancelled");

          const seg = segments[s];
          const segmentLabel = t("upload_segment_info", String(s + 1), String(segments.length));
          
          updateItemStatus(item.id, {
            status: "transcribing",
            segmentInfo: segmentLabel,
            progressPercent: Math.round(50 + (s / segments.length) * 45),
          });

          addLog("info", `[Queue] Transcribing segment ${s + 1}/${segments.length} of: ${item.name}`);

          const b64 = await blobToBase64(seg.blob);
          if (isAborted) throw new Error("cancelled");

          let chunkText = "";
          let generatorAborted = false;

          // Push cancellation handler for this segment generator
          segmentGeneratorControllers.push(() => {
            generatorAborted = true;
          });

          const generator = streamAudio(
            settings,
            template,
            b64,
            "audio/wav",
            (level, msg, detail) => {
              addLog(level, `[Queue] ${item.name} (${s + 1}/${segments.length}): ${msg}`, detail);
            },
            (used) => { usedModelId = used; },
            Math.round((seg.end - seg.start) * 1000),
          );

          for await (const chunk of generator) {
            if (isAborted || generatorAborted) break;
            updateItemText(item.id, chunk, true);
            chunkText += chunk;
          }

          if (isAborted || generatorAborted) throw new Error("cancelled");

          completeTranscriptText += chunkText;
        }

        // Processing finished successfully
        if (isAborted) throw new Error("cancelled");
        
        updateItemStatus(item.id, {
          status: "completed",
          progressPercent: 100,
          segmentInfo: "",
        });
        
        addLog("success", `[Queue] Finished transcribing: ${item.name}`);

        // Save history if enabled
        if (settings.saveHistory && completeTranscriptText) {
          await saveHistory({
            id: crypto.randomUUID(),
            created_at: Date.now(),
            template_id: template.id,
            template_snapshot: JSON.stringify(template),
            model: usedModelId,
            audio_path: null,
            duration_ms: durationMs,
            output_text: completeTranscriptText,
            estimated_tokens: Math.floor(completeTranscriptText.length / 4),
          });
          await refreshAnalytics(settings.apiKey || undefined);
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg === "cancelled" || isAborted) {
          updateItemStatus(item.id, {
            status: "cancelled",
            progressPercent: 0,
            segmentInfo: "",
          });
          addLog("warn", `[Queue] Cancelled processing of: ${item.name}`);
        } else {
          updateItemStatus(item.id, {
            status: "failed",
            error: errorMsg,
            progressPercent: 0,
            segmentInfo: "",
          });
          addLog("error", `[Queue] Failed to process ${item.name}`, errorMsg);
        }
      }
    }

    setIsProcessing(false);
    isProcessingRef.current = false;
    activeProcessRef.current = null;
    addLog("success", "[Queue] Batch processing sequence completed.");
  };

  // Cancel overall queue processing
  const handleCancelAll = () => {
    setIsProcessing(false);
    isProcessingRef.current = false;
    cancelProcessing();
    queue.forEach((item) => {
      if (item.status === "decoding" || item.status === "transcribing" || item.status === "pending") {
        updateItemStatus(item.id, { status: "cancelled", progressPercent: 0, segmentInfo: "" });
      }
    });
  };

  const activeItem = queue.find((item) => item.id === selectedItemId);

  const selectOptions = templates.map((tpl) => ({
    value: tpl.id,
    label: lang === "en" && tpl.name_en ? tpl.name_en : tpl.name,
    hint: tpl.model ? (KNOWN_MODELS.find((m) => m.id === tpl.model)?.label || tpl.model) : undefined
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="page-header shrink-0 flex items-center justify-between">
        <h1 className="page-title">{t("upload_title")}</h1>
        <QuotaIndicator modelId={templates.find((t) => t.id === selectedTemplateId)?.model || settings.selectedModel} />
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Controls & Settings on top, Drag & Drop / Queue at bottom */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex-1 flex flex-col overflow-hidden p-5 gap-4 border-inline-end transition-colors duration-200"
          style={{ borderInlineEnd: "1px solid var(--border)" }}
        >
          {/* Hidden file input for triggering file selection */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="audio/*,video/*"
            className="hidden"
          />

          {/* Settings & Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 shrink-0" style={{ border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" }}>
            {/* Template selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                {t("upload_select_template")}
              </label>
              <Select
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                disabled={isProcessing}
                options={selectOptions}
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
            </div>

            {/* Segment Split Duration */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                {t("upload_split_interval")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={splitInterval}
                  onChange={(e) => setSplitInterval(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="flex-1 accent-[var(--accent)]"
                />
                <span className="font-mono text-sm font-bold min-w-[2.5rem] text-center" style={{ color: "var(--text)" }}>
                  {splitInterval}m
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="md:col-span-2 flex justify-end gap-3 mt-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              {isProcessing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelAll}
                    className="btn-danger flex items-center gap-2 py-2 px-4 rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ border: "none" }}
                  >
                    <Square size={14} fill="currentColor" />
                    {t("upload_btn_cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={true}
                    className="btn-primary flex items-center gap-2 py-2 px-4 rounded-xl font-medium cursor-not-allowed shadow-md opacity-100 animate-pulse"
                    style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
                  >
                    <Loader2 size={14} className="animate-spin text-white" />
                    {t("rec_processing")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startProcessing}
                  disabled={queue.length === 0}
                  className="btn-primary flex items-center gap-2 py-2 px-4 rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play size={14} fill="currentColor" />
                  {t("upload_btn_start")}
                </button>
              )}
            </div>
          </div>

          {queue.length === 0 ? (
            /* Large Drag & Drop Zone */
            <div
              onClick={triggerFileSelect}
              className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed transition-all cursor-pointer select-none"
              style={{
                borderColor: dragOver ? "var(--accent)" : "var(--border)",
                background: dragOver ? "var(--accent-soft)" : "var(--surface)",
                borderRadius: "12px",
              }}
            >
              <Upload
                size={36}
                className={`mb-3 transition-transform ${dragOver ? "scale-110" : ""}`}
                style={{ color: dragOver ? "var(--accent)" : "var(--muted)" }}
              />
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                {t("upload_drag_drop")}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {t("upload_desc")}
              </p>
            </div>
          ) : (
            /* Queue Panel */
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: "12px", background: "var(--surface)" }}>
              {/* Queue Header */}
              <div className="flex justify-between items-center px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                  {t("upload_queue")} ({queue.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    disabled={isProcessing}
                    className="flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--surface-3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
                    title={t("upload_add_files")}
                    style={{ background: "var(--surface)", color: "var(--text)", width: "28px", height: "28px" }}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={clearQueue}
                    disabled={isProcessing}
                    className="btn-danger flex items-center gap-1.5 py-1 px-2.5 text-xs rounded-lg"
                    style={{ border: "none" }}
                  >
                    <Trash2 size={12} />
                    {t("upload_clear_queue")}
                  </button>
                </div>
              </div>

              {/* Queue List Items */}
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--border)]">
                {queue.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className="flex items-center justify-between p-3.5 cursor-pointer transition-colors"
                      style={{
                        background: isSelected ? "var(--surface-2)" : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {item.type === "video" ? (
                          <FileVideo size={20} className="shrink-0" style={{ color: "var(--accent-2)" }} />
                        ) : (
                          <FileAudio size={20} className="shrink-0" style={{ color: "var(--accent)" }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                            {item.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            {formatSize(item.size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {/* Status Label */}
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-semibold flex items-center gap-1">
                            {item.status === "pending" && (
                              <span style={{ color: "var(--muted)" }}>{t("upload_status_pending")}</span>
                            )}
                            {item.status === "decoding" && (
                              <span className="flex items-center gap-1 text-[var(--accent-2)]">
                                <Loader2 size={12} className="animate-spin" />
                                {t("upload_status_decoding")}
                              </span>
                            )}
                            {item.status === "transcribing" && (
                              <span className="flex items-center gap-1 text-[var(--accent)]">
                                <Loader2 size={12} className="animate-spin" />
                                {t("upload_status_transcribing")}
                              </span>
                            )}
                            {item.status === "completed" && (
                              <span className="flex items-center gap-1 text-[var(--success)]">
                                <CheckCircle size={12} />
                                {t("upload_status_completed")}
                              </span>
                            )}
                            {item.status === "failed" && (
                              <span className="flex items-center gap-1 text-[var(--danger)]">
                                <AlertCircle size={12} />
                                {t("upload_status_failed")}
                              </span>
                            )}
                            {item.status === "cancelled" && (
                              <span style={{ color: "var(--muted)" }}>{t("upload_status_cancelled")}</span>
                            )}
                          </span>
                          {item.segmentInfo && (
                            <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                              {item.segmentInfo}
                            </span>
                          )}
                        </div>

                        {/* Progress Bar (if processing) */}
                        {(item.status === "decoding" || item.status === "transcribing") && (
                          <div className="w-16 bg-[var(--surface-3)] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-300"
                              style={{
                                width: `${item.progressPercent}%`,
                                background: item.status === "decoding" ? "var(--accent-2)" : "var(--accent)",
                              }}
                            />
                          </div>
                        )}

                        {/* Item Delete Button */}
                        {item.status !== "decoding" && item.status !== "transcribing" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(item.id);
                            }}
                            disabled={isProcessing}
                            className="text-[var(--muted)] hover:text-[var(--danger)] p-1 rounded transition-colors disabled:opacity-40"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active/Selected File Transcript Output */}
        <div className="w-full lg:w-96 flex flex-col overflow-hidden bg-[var(--surface)] p-5 relative">
          {activeItem && (activeItem.status === "decoding" || activeItem.status === "transcribing") && (
            <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden z-10">
              <div 
                className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-all duration-300 relative"
                style={{ width: `${activeItem.progressPercent}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-white opacity-50 blur-sm animate-[pulse_1.5s_infinite]" />
              </div>
            </div>
          )}

          {activeItem ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold truncate" style={{ color: "var(--text)" }}>
                    {activeItem.name}
                  </h3>
                  <p className="text-base font-extrabold flex items-center gap-2 mt-2" style={{ color: activeItem.status === "completed" ? "var(--success)" : activeItem.status === "failed" ? "var(--danger)" : activeItem.status === "decoding" || activeItem.status === "transcribing" ? "var(--accent)" : "var(--muted)" }}>
                    {(activeItem.status === "decoding" || activeItem.status === "transcribing") && (
                      <Loader2 size={16} className="animate-spin text-[var(--accent)] shrink-0" />
                    )}
                    <span>
                      {activeItem.status === "completed" 
                        ? t("rec_done") 
                        : activeItem.status === "failed" 
                        ? t("upload_status_failed") 
                        : activeItem.status === "cancelled"
                        ? t("upload_status_cancelled")
                        : activeItem.status === "decoding"
                        ? t("upload_status_decoding")
                        : activeItem.status === "transcribing"
                        ? t("upload_status_transcribing")
                        : t("upload_status_pending")}
                    </span>
                    {activeItem.segmentInfo && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] ms-2 inline-flex items-center">
                        {activeItem.segmentInfo}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 items-center shrink-0">
                  <button
                    onClick={() => handleCopy(activeItem.id, activeItem.outputText)}
                    disabled={!activeItem.outputText}
                    className="icon-btn hover:scale-105 transition-transform disabled:opacity-40"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
                    title={t("rec_copy")}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleExportPDF(activeItem.name, activeItem.outputText)}
                    disabled={activeItem.status !== "completed" || !activeItem.outputText}
                    className="icon-btn hover:scale-105 transition-transform disabled:opacity-40"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
                    title={t("upload_btn_export_pdf")}
                  >
                    <FileText size={14} />
                  </button>
                </div>
              </div>

              {activeItem.error && (
                <div className="p-3 text-xs mb-3 shrink-0" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: "8px" }}>
                  {activeItem.error}
                </div>
              )}

              {/* Live Appending Transcript Display */}
              <div className="flex-1 flex flex-col min-h-0">
                {(!activeItem.outputText && (activeItem.status === "decoding" || activeItem.status === "transcribing")) ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl gap-5">
                    <div className="relative flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center shadow-lg shadow-[var(--accent-soft)]">
                        <Loader2 className="animate-spin text-white" size={24} />
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-bold text-[var(--text)] mb-1 uppercase tracking-wide">
                        {activeItem.status === "decoding" ? t("upload_status_decoding") : t("upload_status_transcribing")}
                      </h4>
                      <p className="text-xs text-[var(--muted)] max-w-[240px] leading-relaxed">
                        {activeItem.status === "decoding" 
                          ? (lang === "ar" ? "جاري استخراج وتحضير القناة الصوتية..." : "Extracting and preparing audio channel...") 
                          : activeItem.segmentInfo || (lang === "ar" ? "جاري الاتصال بـ Gemini AI لبدء التفريغ..." : "Connecting to Gemini AI for transcription...")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <textarea
                    readOnly
                    value={activeItem.outputText}
                    placeholder={
                      activeItem.status === "pending"
                        ? t("rec_empty")
                        : activeItem.status === "decoding"
                        ? t("upload_status_decoding")
                        : activeItem.status === "transcribing"
                        ? t("rec_receiving")
                        : ""
                    }
                    dir="auto"
                    className="w-full flex-1 p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl outline-none focus:ring-0 resize-none leading-relaxed text-sm whitespace-pre-wrap font-sans overflow-y-auto"
                    style={{ color: "var(--text)" }}
                  />
                )}
              </div>

              {/* Footer word count & Copy feedback status */}
              <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "var(--muted)" }}>
                <span>
                  {activeItem.outputText ? `${activeItem.outputText.split(/\s+/).filter(Boolean).length} words` : ""}
                </span>
                <span>
                  {copiedId === activeItem.id && <span style={{ color: "var(--success)" }}>{t("rec_copied")}</span>}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6" style={{ color: "var(--muted)" }}>
              <FileText size={48} strokeWidth={1.25} className="mb-3" />
              <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-2)" }}>
                {t("hist_select")}
              </h3>
              <p className="text-xs max-w-[200px]">
                {t("rec_empty")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
