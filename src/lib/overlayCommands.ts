// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Persistent bridge for commands dispatched from the floating overlay control
 * bar (start / stop / pause / resume / cancel).
 *
 * The overlay emits `overlay:<cmd>` Tauri events. The Recorder owns the actual
 * recording logic but is only mounted on the "/" route — so its handlers must
 * be registered here, in module scope, rather than via route-scoped event
 * listeners. App (always mounted) owns the Tauri listeners and dispatches into
 * this handler, so the overlay works from any screen, mirroring how global
 * command hotkeys persist via setCommandHotkeyHandler.
 */
export type OverlayCommand = "start" | "stop" | "pause" | "resume" | "cancel";

let handler: ((cmd: OverlayCommand) => void) | null = null;

/** Install the single handler all overlay commands route through. */
export function setOverlayCommandHandler(h: (cmd: OverlayCommand) => void): void {
  handler = h;
}

/** Invoke the installed handler (no-op if none registered yet). */
export function dispatchOverlayCommand(cmd: OverlayCommand): void {
  handler?.(cmd);
}
