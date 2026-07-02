// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Warid Cloud client — talks to the private gateway (Cloudflare Worker) instead of
 * a provider directly. The gateway holds the paid Gemini key, enforces the plan's
 * audio-minute quota, and streams the answer back. This file is only reached when
 * `CLOUD_ENABLED` and the user's `accountMode === "cloud"`.
 *
 * `streamCloud` yields the same plain-text chunks as `streamTranscription`, so the
 * watchdog, request tracker, retry loop and Recorder all consume it unchanged.
 */

import type { Template } from "../types";
import type { OnLog } from "./gemini";
import { buildPrompt } from "./prompts";

/** Thrown when the account has no audio-minutes left this cycle (HTTP 402). */
export const CLOUD_OUT_OF_MINUTES = "CLOUD_OUT_OF_MINUTES";
/** Thrown when the per-user/IP rate limit is hit (HTTP 429). */
export const CLOUD_RATE_LIMITED = "CLOUD_RATE_LIMITED";
/** Thrown when the session is missing/expired (HTTP 401). */
export const CLOUD_UNAUTHORIZED = "CLOUD_UNAUTHORIZED";

export interface CloudMe {
  plan: "free" | "plus" | "pro";
  minutesUsed: number;
  minutesLimit: number;
  cycleResetAt: number | null;
  email: string;
}

function authHeaders(sessionToken: string): HeadersInit {
  return { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" };
}

/** Map a non-OK gateway response to a stable, catchable error code. */
async function throwForStatus(resp: Response): Promise<never> {
  if (resp.status === 401) throw new Error(CLOUD_UNAUTHORIZED);
  if (resp.status === 402) throw new Error(CLOUD_OUT_OF_MINUTES);
  if (resp.status === 429) throw new Error(CLOUD_RATE_LIMITED);
  const body = await resp.text().catch(() => "");
  throw new Error(`Cloud ${resp.status}: ${body.slice(0, 300)}`);
}

/**
 * Stream a transcription through the Warid Cloud gateway. The gateway relays the
 * provider stream as SSE in the same `data:`/delta shape `streamOpenRouter` parses.
 */
export async function* streamCloud(
  sessionToken: string,
  gatewayUrl: string,
  template: Template,
  audioBase64: string,
  mimeType: string,
  durationMs: number,
  onLog?: OnLog,
  promptOverride?: string,
): AsyncGenerator<string> {
  const prompt = promptOverride ?? buildPrompt(template);

  const tReq = Date.now();
  onLog?.("info", `→ POST ${gatewayUrl}/v1/transcribe (Warid Cloud)`, `audio=${(audioBase64.length / 1024).toFixed(1)}KB dur=${Math.round(durationMs)}ms`);
  const resp = await fetch(`${gatewayUrl}/v1/transcribe`, {
    method: "POST",
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ prompt, audio: audioBase64, mimeType, durationMs }),
  });

  if (!resp.ok || !resp.body) await throwForStatus(resp);

  const reader = resp.body!.getReader();
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
        onLog?.("info", `← cloud stream complete: ${totalChars} chars in ${Date.now() - tReq}ms`);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        // Gateway may relay an error mid-stream as { error: "..." }.
        if (parsed.error) throw new Error(String(parsed.error));
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) {
          if (firstToken) {
            onLog?.("success", `← first token in ${Date.now() - tReq}ms`);
            firstToken = false;
          }
          totalChars += text.length;
          yield text;
        }
      } catch (err) {
        // Re-throw genuine gateway errors; ignore malformed SSE keep-alive lines.
        if (err instanceof Error && err.message && !/JSON/i.test(err.message)) throw err;
      }
    }
  }
  onLog?.("info", `← cloud stream complete: ${totalChars} chars in ${Date.now() - tReq}ms`);
}

/** Fetch the signed-in account's plan + remaining audio-minutes. */
export async function getCloudMe(sessionToken: string, gatewayUrl: string): Promise<CloudMe> {
  const resp = await fetch(`${gatewayUrl}/v1/me`, { headers: authHeaders(sessionToken) });
  if (!resp.ok) await throwForStatus(resp);
  const j = await resp.json();
  return {
    plan: j.plan ?? "free",
    minutesUsed: Number(j.minutesUsed ?? 0),
    minutesLimit: Number(j.minutesLimit ?? 0),
    cycleResetAt: j.cycleResetAt ?? null,
    email: j.email ?? "",
  };
}

/** Ask the gateway for a Lemon Squeezy hosted-checkout URL for the given plan. */
export async function createCheckout(
  sessionToken: string,
  gatewayUrl: string,
  plan: "plus" | "pro",
  cycle: "monthly" | "annual" = "monthly",
): Promise<string> {
  const resp = await fetch(`${gatewayUrl}/v1/billing/checkout`, {
    method: "POST",
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ plan, cycle }),
  });
  if (!resp.ok) await throwForStatus(resp);
  const j = await resp.json();
  if (!j.url) throw new Error("Checkout URL missing from gateway response");
  return j.url as string;
}
