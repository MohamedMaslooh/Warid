// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  register,
  unregister,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut";

export type HotkeyHandler = (accelerator: string) => void;

const MOD_CANONICAL: Record<string, string> = {
  ctrl: "CommandOrControl",
  control: "CommandOrControl",
  cmd: "CommandOrControl",
  command: "CommandOrControl",
  commandorcontrol: "CommandOrControl",
  cmdorctrl: "CommandOrControl",
  meta: "Meta",
  super: "Meta",
  win: "Meta",
  alt: "Alt",
  option: "Alt",
  opt: "Alt",
  shift: "Shift",
};

const MOD_ORDER = ["CommandOrControl", "Meta", "Alt", "Shift"];

/**
 * Canonicalize a Tauri accelerator string so different spellings of the same
 * combo compare equal (e.g. "ctrl+shift+r" === "Control+Shift+R" ===
 * "CommandOrControl+Shift+R"). Returns "" for empty/invalid input.
 */
export function normalizeAccelerator(input: string | null | undefined): string {
  if (!input) return "";
  const parts = input
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";

  const mods = new Set<string>();
  let key = "";
  for (const raw of parts) {
    const canonical = MOD_CANONICAL[raw.toLowerCase()];
    if (canonical) {
      mods.add(canonical);
    } else {
      // Last non-modifier token wins as the main key.
      key = raw.length === 1 ? raw.toUpperCase() : raw;
    }
  }
  if (!key) return "";

  const orderedMods = MOD_ORDER.filter((m) => mods.has(m));
  return [...orderedMods, key].join("+");
}

/**
 * Build a Tauri accelerator from a keyboard event captured via `keydown`.
 * Returns "" if the user has only pressed a modifier so far.
 */
export function acceleratorFromEvent(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push("CommandOrControl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");

  let key = e.key;
  // Bare modifier press — caller should wait for a real key.
  if (["Control", "Meta", "Alt", "Shift", "OS"].includes(key)) return "";

  // Map common keys to Tauri/Electron accelerator names.
  if (key === " ") key = "Space";
  else if (key === "ArrowUp") key = "Up";
  else if (key === "ArrowDown") key = "Down";
  else if (key === "ArrowLeft") key = "Left";
  else if (key === "ArrowRight") key = "Right";
  else if (key === "Escape") key = "Esc";
  else if (key.length === 1) key = key.toUpperCase();

  return [...mods, key].join("+");
}

const isMac = navigator.userAgent.includes("Mac");

// On macOS, modifiers render as glyphs (⌃⌥⇧⌘) with no separators, in Apple's
// canonical order, matching how native Mac apps show shortcuts.
const MAC_SYMBOLS: Record<string, string> = {
  Control: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Meta: "⌘",
  CommandOrControl: "⌘",
};
const MAC_MOD_ORDER = ["Control", "Alt", "Shift", "Meta", "CommandOrControl"];

/** Pretty-print an accelerator for display in the UI. */
export function formatAccelerator(accel: string | null | undefined): string {
  if (!accel) return "";
  const normalized = normalizeAccelerator(accel);
  if (!normalized) return "";

  const parts = normalized.split("+");
  if (!isMac) {
    return parts.map((p) => (p === "CommandOrControl" ? "Ctrl" : p)).join("+");
  }

  const mods = parts.filter((p) => p in MAC_SYMBOLS);
  const keys = parts.filter((p) => !(p in MAC_SYMBOLS));
  const glyphs = MAC_MOD_ORDER.filter((m) => mods.includes(m)).map((m) => MAC_SYMBOLS[m]);
  return [...glyphs, ...keys].join("");
}

export async function registerCommandHotkey(
  accelerator: string,
  handler: HotkeyHandler,
): Promise<void> {
  const normalized = normalizeAccelerator(accelerator);
  if (!normalized) throw new Error(`Invalid accelerator: ${accelerator}`);
  if (await isRegistered(normalized)) {
    await unregister(normalized);
  }
  await register(normalized, (event) => {
    // Only fire on press, not release.
    if (event.state === "Pressed") handler(normalized);
  });
}

export async function unregisterCommandHotkey(accelerator: string): Promise<void> {
  const normalized = normalizeAccelerator(accelerator);
  if (!normalized) return;
  if (await isRegistered(normalized)) {
    await unregister(normalized);
  }
}
