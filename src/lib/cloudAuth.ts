// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Warid Cloud — authentication + account state (Supabase).
 *
 * Desktop-friendly sign-in via **email OTP code** (a 6-digit code emailed to the
 * user, typed back into the app). This avoids custom URL schemes / deep-link
 * plumbing entirely. OAuth-via-deep-link can be added later as an enhancement.
 *
 * The Supabase client is created lazily, so importing this module has no side
 * effects and public (BYOK-only) builds never initialise it. Sessions persist in
 * the webview's localStorage AND are mirrored into settings.json (so the gateway
 * has a token to send); access tokens auto-refresh in the background.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./cloudConfig";
import { getCloudMe, CLOUD_UNAUTHORIZED } from "./cloud";
import { CLOUD_GATEWAY_URL } from "./cloudConfig";
import { useSettingsStore } from "../stores/settingsStore";

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase is not configured");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    // Keep settings.json in sync with the live session so the gateway always has
    // a current token even after a background refresh.
    client.auth.onAuthStateChange((_event, session) => {
      void mirrorSession(session?.access_token ?? "", session?.refresh_token ?? "", session?.user?.email ?? "");
    });
  }
  return client;
}

async function mirrorSession(accessToken: string, refreshToken: string, email: string): Promise<void> {
  const patch: Record<string, unknown> = { cloudSessionToken: accessToken, cloudRefreshToken: refreshToken };
  if (email) patch.cloudEmail = email;
  await useSettingsStore.getState().update(patch);
}

/** Email a 6-digit sign-in code (creates the account on first use). */
export async function sendLoginCode(email: string): Promise<void> {
  const { error } = await sb().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

/** Verify the emailed code → establishes a session and mirrors it to settings. */
export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const { data, error } = await sb().auth.verifyOtp({ email, token: code.trim(), type: "email" });
  if (error) throw error;
  const s = data.session;
  if (!s) throw new Error("No session returned from Supabase");
  await mirrorSession(s.access_token, s.refresh_token, data.user?.email ?? email);
  await useSettingsStore.getState().update({ accountMode: "cloud" });
}

/** Restore a persisted session (call once on app start when in cloud mode). */
export async function restoreCloudSession(accessToken: string, refreshToken: string): Promise<void> {
  if (!accessToken || !refreshToken) return;
  try {
    await sb().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  } catch {
    /* expired/invalid — user will be prompted to sign in again */
  }
}

/** Current valid access token, refreshing transparently if needed. */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await sb().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function signOutCloud(): Promise<void> {
  try { if (client) await client.auth.signOut(); } catch { /* ignore */ }
  await useSettingsStore.getState().update({
    accountMode: "byok",
    cloudSessionToken: "",
    cloudRefreshToken: "",
    cloudEmail: "",
    cloudPlan: "free",
    cloudMinutesUsed: 0,
    cloudMinutesLimit: 0,
  });
}

/**
 * Pull the latest plan + balance from the gateway and mirror into settings so the
 * balance indicator stays current. Silent no-op when signed out.
 */
export async function refreshCloudAccount(): Promise<void> {
  const token = await getAccessToken();
  if (!token || !CLOUD_GATEWAY_URL) return;
  try {
    const me = await getCloudMe(token, CLOUD_GATEWAY_URL);
    await useSettingsStore.getState().update({
      cloudPlan: me.plan,
      cloudMinutesUsed: me.minutesUsed,
      cloudMinutesLimit: me.minutesLimit,
      cloudEmail: me.email || useSettingsStore.getState().settings.cloudEmail,
    });
  } catch (err) {
    if (err instanceof Error && err.message === CLOUD_UNAUTHORIZED) await signOutCloud();
  }
}
