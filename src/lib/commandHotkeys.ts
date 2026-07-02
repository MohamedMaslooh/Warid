// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Template } from "../types";
import {
  normalizeAccelerator,
  registerCommandHotkey,
  unregisterCommandHotkey,
  type HotkeyHandler,
} from "./hotkey";

/**
 * Current registration state: maps a normalized accelerator → template id.
 * Lives in module scope so re-renders don't duplicate registrations.
 */
const registered = new Map<string, string>();

let activeHandler: HotkeyHandler | null = null;

/**
 * Install the single handler that all command hotkeys route through.
 * The handler receives the normalized accelerator; callers resolve it to a
 * template themselves to avoid stale closures over template arrays.
 *
 * Call once at app startup. Safe to call multiple times — replaces the previous
 * handler so future hotkey fires use the latest closure.
 */
export function setCommandHotkeyHandler(handler: HotkeyHandler): void {
  activeHandler = handler;
}

function dispatch(accel: string) {
  activeHandler?.(accel);
}

export interface SyncResult {
  /** Hotkeys that failed to register, with reason (e.g. taken by the OS). */
  errors: { accelerator: string; templateId: string; error: string }[];
}

/**
 * Reconcile the registered global shortcuts with the current set of templates.
 * Registers new/changed hotkeys, unregisters removed ones. Templates with no
 * hotkey or a duplicate accelerator are skipped (first one wins).
 */
export async function syncCommandHotkeys(templates: Template[]): Promise<SyncResult> {
  const errors: SyncResult["errors"] = [];
  const desired = new Map<string, string>(); // accel → templateId

  for (const t of templates) {
    if (t.is_upload_only === 1) continue;
    const norm = normalizeAccelerator(t.hotkey);
    if (!norm) continue;
    if (desired.has(norm)) continue; // duplicate — first template wins
    desired.set(norm, t.id);
  }

  // Unregister anything no longer wanted, or whose template changed.
  for (const [accel, templateId] of Array.from(registered.entries())) {
    if (desired.get(accel) !== templateId) {
      try {
        await unregisterCommandHotkey(accel);
      } catch {
        // ignore — best-effort cleanup
      }
      registered.delete(accel);
    }
  }

  // Register anything new.
  for (const [accel, templateId] of desired) {
    if (registered.has(accel)) continue;
    try {
      await registerCommandHotkey(accel, dispatch);
      registered.set(accel, templateId);
    } catch (err) {
      errors.push({
        accelerator: accel,
        templateId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { errors };
}

/** Returns the template id currently bound to this normalized accelerator. */
export function templateIdForAccelerator(accel: string): string | undefined {
  return registered.get(normalizeAccelerator(accel));
}
