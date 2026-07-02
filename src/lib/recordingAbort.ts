// SPDX-License-Identifier: AGPL-3.0-or-later

/** Module-level abort signal shared between Recorder and the global cancel hotkey. */
export const abortSignal = { current: false };

export function requestAbort(): void {
  abortSignal.current = true;
}

export function clearAbortSignal(): void {
  abortSignal.current = false;
}
