// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  normalizeAccelerator,
  registerCommandHotkey,
  unregisterCommandHotkey,
} from "./hotkey";
import { recorder } from "./sharedRecorder";
import { abortSignal } from "./recordingAbort";
import { useRecordingStore } from "../stores/recordingStore";
import { hideOverlay } from "./overlayWindow";
import { playBeep } from "./audio";

let registeredAccel: string | null = null;

/**
 * Cancel any active recording or processing session.
 * Safe to call from any context — checks state before acting.
 */
export async function doCancel(): Promise<void> {
  const { state, reset } = useRecordingStore.getState();
  if (state !== "recording" && state !== "processing") return;
  if (state === "recording") {
    recorder.cancel();
  } else {
    abortSignal.current = true;
  }
  playBeep("cancel");
  reset();
  await hideOverlay();
}

/**
 * Register (or re-register) the global cancel shortcut.
 * Pass null/empty to unregister without registering a new one.
 */
export async function syncCancelHotkey(
  accel: string | null | undefined,
): Promise<void> {
  const next = normalizeAccelerator(accel);

  if (registeredAccel === next) return;

  if (registeredAccel) {
    try {
      await unregisterCommandHotkey(registeredAccel);
    } catch {
      // best-effort cleanup
    }
    registeredAccel = null;
  }

  if (!next) return;

  await registerCommandHotkey(next, () => {
    void doCancel();
  });
  registeredAccel = next;
}
