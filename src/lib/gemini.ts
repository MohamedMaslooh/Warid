import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LogLevel } from "../stores/logStore";
import type { Settings, Template } from "../types";
import { buildPrompt } from "./prompts";
import { t } from "./i18n";
import { CLOUD_ENABLED, CLOUD_GATEWAY_URL } from "./cloudConfig";
import { streamCloud } from "./cloud";
import { getAccessToken } from "./cloudAuth";

export type OnLog = (level: LogLevel, msg: string, detail?: string) => void;

/** Above this base64 size, switch to Files API instead of inline data.
 *  Gemini hard-limits inline payloads (~20MB inline ~= 15MB raw). We use a
 *  conservative threshold so we never hit it. */
const INLINE_AUDIO_LIMIT_B64 = 5 * 1024 * 1024; // 5MB base64 ≈ 3.7MB raw audio

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Upload an audio blob to Gemini's Files API using the resumable protocol.
 * Returns { uri, mimeType } that can be passed as `fileData` in generateContent.
 * Files live ~48h on Google's servers, plenty for one transcription call.
 */
async function uploadToGeminiFilesAPI(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  onLog?: OnLog,
): Promise<{ uri: string; mimeType: string }> {
  const bytes = base64ToBytes(audioBase64);
  const sizeMB = (bytes.byteLength / 1024 / 1024).toFixed(2);
  const t0 = Date.now();
  onLog?.("info", `↑ Uploading audio to Gemini Files API`, `size=${sizeMB}MB mime=${mimeType}`);

  // Step 1 — initiate resumable upload, get upload URL from the response header.
  const initResp = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: `warid-${Date.now()}` } }),
    },
  );

  if (!initResp.ok) {
    const txt = await initResp.text();
    throw new Error(`Files API init failed ${initResp.status}: ${txt.slice(0, 300)}`);
  }

  const uploadUrl = initResp.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Files API: missing upload URL header");

  // Step 2 — upload the bytes and finalize in one shot.
  // Wrap in Blob to give fetch a BodyInit-compatible type (some TS DOM lib
  // versions reject raw Uint8Array as a fetch body).
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: blob,
  });

  if (!uploadResp.ok) {
    const txt = await uploadResp.text();
    throw new Error(`Files API upload failed ${uploadResp.status}: ${txt.slice(0, 300)}`);
  }

  const json = await uploadResp.json();
  const file = json.file;
  if (!file?.uri) throw new Error("Files API: response missing file.uri");

  onLog?.("success", `↑ Upload done in ${Date.now() - t0}ms`, `uri=${file.uri}`);
  return { uri: file.uri, mimeType: file.mimeType ?? mimeType };
}

export async function* streamTranscription(
  apiKey: string,
  model: string,
  template: Template,
  audioBase64: string,
  mimeType: string,
  onLog?: OnLog,
  promptOverride?: string,
): AsyncGenerator<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Disable thinking on models that support it (2.5+ / 3.x). thinkingBudget:0
  // forces the model to skip its internal reasoning step and emit tokens
  // immediately — massive latency win for transcription where reasoning adds
  // nothing. Unknown fields are ignored by older models.
  const genModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      // @ts-expect-error — thinkingConfig is supported by the REST API but not
      // yet typed in @google/generative-ai
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const prompt = promptOverride ?? buildPrompt(template);

  // Decide inline vs. Files API. Large audio MUST go through Files API or the
  // request body will exceed Gemini's inline limit and fail silently/with 400.
  let audioPart;
  if (audioBase64.length > INLINE_AUDIO_LIMIT_B64) {
    const uploaded = await uploadToGeminiFilesAPI(apiKey, audioBase64, mimeType, onLog);
    audioPart = { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } };
  } else {
    audioPart = { inlineData: { mimeType, data: audioBase64 } };
  }

  const tReq = Date.now();
  onLog?.(
    "info",
    `→ POST generateContentStream (thinking=off)`,
    `model=${model} audio=${(audioBase64.length / 1024).toFixed(1)}KB mode=${"fileData" in audioPart ? "files-api" : "inline"}`,
  );
  const result = await genModel.generateContentStream([prompt, audioPart]);
  let firstToken = true;
  let totalChars = 0;
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      if (firstToken) {
        onLog?.("success", `← first token in ${Date.now() - tReq}ms`);
        firstToken = false;
      }
      totalChars += text.length;
      yield text;
    }
  }
  onLog?.("info", `← stream complete: ${totalChars} chars in ${Date.now() - tReq}ms`);
}

export async function* streamOpenRouter(
  apiKey: string,
  model: string,
  template: Template,
  audioBase64: string,
  mimeType: string,
  serviceTier?: "flex" | "priority" | null,
  onLog?: OnLog,
  promptOverride?: string,
): AsyncGenerator<string> {
  const prompt = promptOverride ?? buildPrompt(template);
  const format = mimeType.includes("webm") ? "webm"
    : mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("wav") ? "wav"
    : "webm";

  const body: Record<string, unknown> = {
    model,
    stream: true,
    // Disable any internal reasoning for fastest first-token latency.
    reasoning: { exclude: true, max_tokens: 0 },
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "input_audio", input_audio: { data: audioBase64, format } },
      ],
    }],
  };
  if (serviceTier) body.service_tier = serviceTier;

  const tReq = Date.now();
  onLog?.("info", `→ POST openrouter.ai/v1/chat/completions (reasoning=off)`, `model=${model}`);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 300)}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstToken = true;
  let totalChars = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        onLog?.("info", `← stream complete: ${totalChars} chars in ${Date.now() - tReq}ms`);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) {
          if (firstToken) {
            onLog?.("success", `← first token in ${Date.now() - tReq}ms`);
            firstToken = false;
          }
          totalChars += text.length;
          yield text;
        }
      } catch { /* skip malformed SSE lines */ }
    }
  }
  onLog?.("info", `← stream complete: ${totalChars} chars in ${Date.now() - tReq}ms`);
}

export type ModelQuota =
  | { type: "free"; rpm: number; rpd: number }
  | { type: "free_or_paid"; freeRpd: number; paidRpd: number }
  | { type: "paid" };

export const KNOWN_MODELS: { id: string; provider: "gemini" | "openrouter"; label: string; quota: ModelQuota }[] = [
  { id: "gemini-3.1-flash-lite",                               provider: "gemini",     label: "Gemini 3.1 Flash Lite",           quota: { type: "free", rpm: 30, rpd: 500 } },
  { id: "gemini-3.5-flash",                                    provider: "gemini",     label: "Gemini 3.5 Flash",                 quota: { type: "free", rpm: 10, rpd: 20 } },
  { id: "gemini-3-flash-preview",                              provider: "gemini",     label: "Gemini 3 Flash Preview",           quota: { type: "free", rpm: 10, rpd: 20 } },
  { id: "gemini-2.5-flash",                                    provider: "gemini",     label: "Gemini 2.5 Flash",                 quota: { type: "free", rpm: 10, rpd: 20 } },
  { id: "gemini-2.5-flash-lite",                               provider: "gemini",     label: "Gemini 2.5 Flash Lite",            quota: { type: "free", rpm: 15, rpd: 20 } },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", provider: "openrouter", label: "Nemotron 3 Nano Omni 30B (free)",  quota: { type: "free_or_paid", freeRpd: 20, paidRpd: 1000 } },
  { id: "google/gemini-3.1-flash-lite",                        provider: "openrouter", label: "Gemini 3.1 Flash Lite (OR)",       quota: { type: "paid" } },
  { id: "google/gemini-3-flash-preview",                       provider: "openrouter", label: "Gemini 3 Flash Preview (OR)",      quota: { type: "paid" } },
  { id: "google/gemini-2.5-flash-lite-preview-09-2025",        provider: "openrouter", label: "Gemini 2.5 Flash Lite Preview (OR)", quota: { type: "paid" } },
];

/** Sentinel id for the "Auto" selection — rotate through free Google models. */
export const AUTO_MODEL_ID = "auto";

/** Sentinel model id recorded in history when a request went through Warid Cloud. */
export const CLOUD_MODEL_ID = "warid-cloud";

/**
 * Ordered priority list of free Google models used by Auto mode. The first
 * entry is tried first; on failure (or when its daily quota is spent) Auto
 * falls through to the next.
 */
export const AUTO_SEQUENCE: string[] = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

/** Daily request cap for a model id, or Infinity when it has no free cap. */
export function modelDailyLimit(modelId: string): number {
  const m = KNOWN_MODELS.find((x) => x.id === modelId);
  if (!m) return Infinity;
  if (m.quota.type === "free") return m.quota.rpd;
  if (m.quota.type === "free_or_paid") return m.quota.freeRpd;
  return Infinity;
}

import { useRequestTrackerStore } from "../stores/requestTrackerStore";

/**
 * Auto-mode candidates in priority order. Healthy models — quota left today and
 * not in a high-demand cooldown — come first, in priority order. Models that are
 * out of quota or temporarily cooling down are appended as a last resort so the
 * user is never hard-blocked (caps and overloads both recover on Google's side).
 */
export function getAutoCandidates(): string[] {
  const tracker = useRequestTrackerStore.getState();
  const preferred: string[] = [];
  const deprioritized: string[] = [];
  for (const id of AUTO_SEQUENCE) {
    const hasQuota = tracker.getRequestCountToday(id) < modelDailyLimit(id);
    if (hasQuota && !tracker.isCoolingDown(id)) preferred.push(id);
    else deprioritized.push(id);
  }
  return [...preferred, ...deprioritized];
}

/** How long to skip a model after it signals high demand / stalls, before
 *  reverting to preferring it again. Temporary, never permanent. */
const HIGH_DEMAND_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
/** Max wait for the FIRST streamed token before abandoning a model. Generous
 *  so large uploads / a momentarily slow model aren't cut off prematurely. */
const FIRST_TOKEN_TIMEOUT_MS = 45_000;
/** Max gap BETWEEN streamed tokens before treating the stream as stalled. */
const STALL_TIMEOUT_MS = 25_000;

/** Thrown when a model produces no output within the watchdog window. */
class ModelTimeoutError extends Error {
  constructor(ms: number) {
    super(`Model produced no output within ${ms}ms`);
    this.name = "ModelTimeoutError";
  }
}

/**
 * True for errors that mean "this model is busy/overloaded right now" — worth
 * cooling it down and trying another. Covers rate limits (429), server overload
 * (500/503/529), and our own no-response timeout.
 */
function isHighDemandError(err: unknown): boolean {
  if (err instanceof ModelTimeoutError) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /\b(429|500|503|529)\b/.test(msg)
    || /overload|unavailable|exhaust|too many requests|rate.?limit|try again/.test(msg);
}

/**
 * Wrap a token stream with watchdog timeouts: the first token must arrive within
 * firstTokenMs, and no inter-token gap may exceed stallMs. On timeout the
 * underlying request is cancelled and a ModelTimeoutError is thrown so Auto can
 * move on. Once a stream completes normally it passes through untouched.
 */
async function* withTimeout(
  gen: AsyncGenerator<string>,
  firstTokenMs: number,
  stallMs: number,
): AsyncGenerator<string> {
  const it = gen[Symbol.asyncIterator]();
  let started = false;
  try {
    while (true) {
      const limit = started ? stallMs : firstTokenMs;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ModelTimeoutError(limit)), limit);
      });
      let res: IteratorResult<string>;
      try {
        res = await Promise.race([it.next(), timeout]);
      } finally {
        clearTimeout(timer);
      }
      if (res.done) return;
      started = true;
      yield res.value;
    }
  } finally {
    // Stop the underlying request if we bailed out early (timeout/cancel).
    try { await it.return?.(undefined as never); } catch { /* best effort */ }
  }
}

async function* streamWithProvider(
  settings: Settings,
  modelId: string,
  template: Template,
  audioBase64: string,
  mimeType: string,
  onLog?: OnLog,
  durationMs = 0,
): AsyncGenerator<string> {
  // Warid Cloud takes over entirely when enabled: the gateway chooses the model
  // and provider server-side, so the client's KNOWN_MODELS routing is bypassed.
  if (CLOUD_ENABLED && settings.accountMode === "cloud") {
    const token = (await getAccessToken()) ?? settings.cloudSessionToken;
    if (!token) throw new Error(t(settings.uiLanguage, "err_cloud_signed_out"));
    yield* streamCloud(token, CLOUD_GATEWAY_URL, template, audioBase64, mimeType, durationMs, onLog);
    return;
  }

  const entry = KNOWN_MODELS.find((m) => m.id === modelId);
  const provider = entry?.provider ?? "gemini";

  if (provider === "gemini") {
    if (!settings.apiKey) throw new Error(t(settings.uiLanguage, "err_no_gemini_key"));
    yield* streamTranscription(settings.apiKey, modelId, template, audioBase64, mimeType, onLog);
  } else {
    if (!settings.openRouterApiKey) throw new Error(t(settings.uiLanguage, "err_no_or_key"));
    yield* streamOpenRouter(settings.openRouterApiKey, modelId, template, audioBase64, mimeType, undefined, onLog);
  }
}

export async function* streamAudio(
  settings: Settings,
  template: Template,
  audioBase64: string,
  mimeType: string,
  onLog?: OnLog,
  /** Reports the model id actually used once a request is genuinely consumed. */
  onModelUsed?: (modelId: string) => void,
  /** Recorded audio length (ms) — forwarded to the cloud gateway for metering. */
  durationMs = 0,
): AsyncGenerator<string> {
  // Warid Cloud path: the gateway owns model selection, failover and metering, so
  // we bypass the local Auto rotation, watchdog and per-model request tracker. The
  // outer retry loop in the caller still provides resilience.
  if (CLOUD_ENABLED && settings.accountMode === "cloud") {
    let consumed = false;
    for await (const chunk of streamWithProvider(settings, CLOUD_MODEL_ID, template, audioBase64, mimeType, onLog, durationMs)) {
      if (!consumed) { consumed = true; onModelUsed?.(CLOUD_MODEL_ID); }
      yield chunk;
    }
    return;
  }

  const configured = template.model || settings.selectedModel;
  const isAuto = configured === AUTO_MODEL_ID;
  const candidates = isAuto ? getAutoCandidates() : [configured];
  if (candidates.length === 0) throw new Error(t(settings.uiLanguage, "err_auto_exhausted"));

  // The first-token watchdog must not punish a big upload (large audio is sent
  // before any token can arrive — via the Files API or a large POST body). Add
  // a size-proportional allowance assuming a pessimistic 50 KB/s floor, so only
  // a genuine hang trips the timeout, never a slow-but-progressing upload.
  const uploadAllowanceMs = (audioBase64.length / (50 * 1024)) * 1000;
  const firstTokenMs = FIRST_TOKEN_TIMEOUT_MS + uploadAllowanceMs;

  const tracker = useRequestTrackerStore.getState();
  let lastError: unknown = null;
  for (let i = 0; i < candidates.length; i++) {
    const modelId = candidates[i];
    // A request is only "consumed" once the model starts responding. We count
    // it on the first emitted token — so failed attempts that never reach the
    // model (network errors, 429 rate limits, key issues) are never billed and
    // retries don't double-count.
    let consumed = false;
    try {
      const base = streamWithProvider(settings, modelId, template, audioBase64, mimeType, onLog, durationMs);
      // Only Auto's seamless multi-model fallback gets watchdog timeouts — an
      // explicitly chosen single model is left to run without a deadline.
      const stream = isAuto ? withTimeout(base, firstTokenMs, STALL_TIMEOUT_MS) : base;
      for await (const chunk of stream) {
        if (!consumed) {
          consumed = true;
          tracker.incrementRequest(modelId);
          onModelUsed?.(modelId);
        }
        yield chunk;
      }
      return; // success — stop the fallback chain
    } catch (err) {
      lastError = err;
      // Remember an overloaded/slow model so this retry — and the next
      // recording — skip straight past it during the cooldown window.
      if (isAuto && isHighDemandError(err)) {
        tracker.markHighDemand(modelId, HIGH_DEMAND_COOLDOWN_MS);
      }
      // If the request was already consumed (tokens streamed, then it broke),
      // don't silently switch models mid-output — surface the error so the
      // caller's retry restarts cleanly (and now skips the cooled-down model).
      if (consumed) throw err;
      const next = candidates[i + 1];
      if (next) {
        const detail = err instanceof Error ? err.message : String(err);
        onLog?.("warn", t(settings.uiLanguage, "log_auto_switch", modelId, next), detail);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

