/**
 * Warid Cloud — build-time feature gate.
 *
 * The hosted, paid "Warid Cloud" tier is OFF unless this build was compiled with
 * `VITE_CLOUD_ENABLED=true` (set in a local `.env.local`, never in public CI). When
 * disabled every cloud code path and UI surface no-ops, so the public/MIT release
 * behaves exactly as the BYOK app does today and never exposes the paid path.
 *
 * Keep ALL cloud UI and the `cloud` provider branch behind `CLOUD_ENABLED`.
 */

export const CLOUD_ENABLED = import.meta.env.VITE_CLOUD_ENABLED === "true";

/** Base URL of the Warid Cloud gateway (Cloudflare Worker). No trailing slash. */
export const CLOUD_GATEWAY_URL = (import.meta.env.VITE_CLOUD_GATEWAY_URL ?? "").replace(/\/+$/, "");

/** Supabase project URL (auth + accounts). */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

/** Supabase anon/publishable key — safe to embed in the client. */
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/**
 * True only when the cloud tier is enabled AND fully configured. UI should fall
 * back to BYOK-only when this is false even if the flag was flipped without env.
 */
export const CLOUD_READY = CLOUD_ENABLED && !!CLOUD_GATEWAY_URL && !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
