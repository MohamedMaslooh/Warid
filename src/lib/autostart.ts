import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export async function setLaunchOnStartup(enabled: boolean): Promise<void> {
  const current = await isEnabled().catch(() => false);
  if (enabled && !current) {
    await enable();
  } else if (!enabled && current) {
    await disable();
  }
}

export async function isLaunchOnStartupEnabled(): Promise<boolean> {
  return isEnabled().catch(() => false);
}

/**
 * One-time self-heal for the 1.0.1 autostart fix. Users who had "Launch on
 * Startup" enabled before the fix may have a stale or missing registry entry.
 * Force re-registration (disable then enable) so the entry points at the
 * freshly installed executable — sparing users from toggling it manually.
 */
export async function reconcileLaunchOnStartup(enabled: boolean): Promise<void> {
  if (!enabled) return;
  await disable().catch(() => {});
  await enable().catch(() => {});
}
