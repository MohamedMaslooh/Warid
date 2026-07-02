// SPDX-License-Identifier: AGPL-3.0-or-later

import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Asks the updater endpoint whether a newer signed release exists.
// Returns the Update handle when one is available, or null when the app is
// up to date or the check fails (offline, network error, etc.).
export async function checkForUpdate(): Promise<Update | null> {
  try {
    return await check();
  } catch {
    return null;
  }
}

// Downloads the pending update WITHOUT installing it, reporting byte progress.
// The bytes are cached on the `update` instance, so the same object must be
// reused for installUpdate() afterwards. `total` is null until the server
// reports a content length.
//
// We deliberately keep download and install separate (rather than the combined
// downloadAndInstall) so the user is prompted to restart explicitly. On Windows
// install() runs the NSIS installer, which must close the app to replace the
// binary — doing that only on an explicit "Restart to install" click keeps the
// behaviour identical across Windows, macOS and Linux.
export async function downloadUpdate(
  update: Update,
  onProgress: (downloaded: number, total: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;
  await update.download((e) => {
    if (e.event === "Started") {
      total = e.data.contentLength ?? null;
      onProgress(downloaded, total);
    } else if (e.event === "Progress") {
      downloaded += e.data.chunkLength;
      onProgress(downloaded, total);
    }
  });
}

// Installs the already-downloaded update and relaunches into the new version.
// On Windows the installer closes the app itself (so relaunch may not be
// reached, and the installer handles the restart); on macOS/Linux the swap is
// applied in place and relaunch() performs the restart.
export async function installUpdate(update: Update): Promise<void> {
  await update.install();
  await relaunch();
}
