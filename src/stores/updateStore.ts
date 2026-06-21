import { create } from "zustand";
import type { Update } from "@tauri-apps/plugin-updater";
import { checkForUpdate, downloadUpdate, installUpdate } from "../lib/updateCheck";

// Phases of the in-app update flow, shared between the toast banner (App) and
// the "Check for updates" button (Settings) so they never disagree.
export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "uptodate"
  | "error";

interface UpdateStore {
  update: Update | null;
  version: string | null;
  notes: string | null;
  phase: UpdatePhase;
  downloaded: number;
  total: number | null;
  dismissed: boolean;
  /** True when the download was started silently (auto-download). The UI hides
   *  progress and only surfaces the banner once the update is ready/errored. */
  silent: boolean;

  // Looks for an update. When `auto` is true and one is found, the download
  // starts immediately (silent path driven by the autoDownloadUpdates setting).
  check: (auto?: boolean) => Promise<void>;
  // Downloads the update (no install). Leaves the flow in the "ready" phase.
  download: () => Promise<void>;
  // Installs the downloaded update and relaunches. Only valid in "ready".
  restart: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  update: null,
  version: null,
  notes: null,
  phase: "idle",
  downloaded: 0,
  total: null,
  dismissed: false,
  silent: false,

  check: async (auto = false) => {
    // Don't restart an in-flight download/check.
    const { phase } = get();
    if (phase === "checking" || phase === "downloading") return;

    set({ phase: "checking" });
    const u = await checkForUpdate();
    if (!u) {
      set({ phase: "uptodate", update: null, version: null, notes: null });
      return;
    }
    // `u.body` carries the release notes (the `notes` field of latest.json,
    // populated from the changelog by the release workflow) so the banner can
    // show what actually changed, not just that an update exists.
    set({ update: u, version: u.version, notes: u.body ?? null, phase: "available", dismissed: false, silent: auto });
    if (auto) void get().download();
  },

  download: async () => {
    const { update, phase } = get();
    if (!update || phase === "downloading") return;
    set({ phase: "downloading", downloaded: 0, total: null });
    try {
      await downloadUpdate(update, (downloaded, total) =>
        set({ downloaded, total }),
      );
      set({ phase: "ready" });
    } catch {
      set({ phase: "error" });
    }
  },

  restart: async () => {
    const { update, phase } = get();
    if (!update || phase !== "ready") return;
    try {
      await installUpdate(update);
    } catch {
      // On Windows the process is killed by the installer before this resolves;
      // reaching here means the install genuinely failed (macOS/Linux).
      set({ phase: "error" });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));
