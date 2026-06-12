# Warid Changelog

This changelog records every meaningful change to the application — features, bug fixes, internal improvements, and release notes — in reverse chronological order (newest first).

**Format:** Each release section lists what was Added, Changed, or Fixed. Where the reason behind a change is not obvious, a brief Problem/Solution note explains it.

---

## [v1.1.3] — 2026-06-12

### Fixed

#### Auto-Paste — Intermittent Failure Regardless of Keyboard Layout

- **Problem:** Auto-paste failed unpredictably. Restarting the app would temporarily restore it, but it would break again after normal use — regardless of whether the keyboard layout was Arabic or English. Two separate bugs combined to produce this:

  1. **Blocked event loop (primary cause of intermittent failure).** `paste_at_cursor` was a synchronous Tauri command, which means it ran on the app's main event-loop thread. The routine calls `window.minimize()` to move Warid out of the way and then immediately checks whether a non-Warid window has taken the foreground — but the minimize *itself* is dispatched on the same event loop that the command was blocking. The minimize never executed until after the command returned, so the safety check always saw Warid still in front and silently aborted without pasting. After a fresh restart Warid's window was already hidden in the tray, bypassing the minimize entirely, so paste worked — until the main window or overlay was brought to the foreground again through normal use.

  2. **Unreliable keystroke injection (secondary, layout-independent).** Ctrl+V was synthesised via `enigo`'s `Key::Unicode('v')`, which translates the character `'v'` through the currently active keyboard layout. Because `enigo` uses `VK_PACKET` for Unicode characters, some applications do not recognise it as the Ctrl+V paste accelerator. This could cause paste to land in the field as a literal character or be dropped entirely, independent of which layout was active.

- **Solution:**
  - Converted `paste_at_cursor` to an `async` command and moved the entire paste routine into a `spawn_blocking` worker thread (`src-tauri/src/lib.rs`). The event loop now stays free, so `window.minimize()` executes while the background thread waits for the focus handoff.
  - Replaced `enigo` entirely on Windows with a direct Win32 `SendInput` call using virtual-key codes (`VK_CONTROL` + `VK_V`) rather than Unicode characters. VK codes are what applications match Ctrl+V accelerators against; they are keyboard-layout-independent and always produce the standard paste shortcut.
  - The four key events (Ctrl-down, V-down, V-up, Ctrl-up) are submitted in a single `SendInput` batch so no real user input can interleave mid-chord.
  - Replaced the fixed 80 ms focus-wait sleep with a polling loop (up to 600 ms) that re-issues the `AttachThreadInput` + `SetForegroundWindow` + `SetFocus` sequence on every tick until a non-Warid window actually holds the foreground, rather than firing once and hoping.
  - Added a held-modifier guard: any Ctrl/Shift/Alt/Win key still physically pressed (e.g., from the stop-recording hotkey) is waited out and then force-released before Ctrl+V is injected, preventing the chord from being interpreted as Ctrl+Shift+V or similar.
  - The command now returns `Result<(), String>` so genuine failures (no target window found, focus never transferred, input blocked by UIPI) are logged in Warid's log panel with an actual reason instead of falsely reporting "pasted". (`src-tauri/src/lib.rs`)
  - Removed `enigo` from Windows dependencies; it is still used as the non-Windows fallback.

---

## [v1.1.2] — 2026-06-02

### Added

#### In-App Automatic Updates
- Integrated `tauri-plugin-updater` and `tauri-plugin-process` (Rust + JS) so Warid can check for, download, and install new releases entirely from within the app.
- On startup the app silently checks GitHub Releases for a newer version. When one is found, a toast banner appears with a **Download** button.
  - Clicking **Download** shows a live progress bar. After the download completes, a **Restart to install** button appears. The app then installs the update and relaunches into the new version.
- **Auto-download mode** (Settings → About, off by default): downloads the update silently in the background, then shows only the "Update ready — Restart to install" prompt.
- Added a manual **Check for updates** button in Settings → About so users can check on demand rather than only at launch.
- Restart to install is blocked while a recording or processing job is in progress — the button is disabled with a "Finish recording first" label until the session ends.
- Release CI (`.github/workflows/release.yml`) now passes `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to `tauri-action` so every release artifact is signed and a `latest.json` manifest is generated automatically.
- CSP widened in `tauri.conf.json` to allow connections to `github.com` and `*.githubusercontent.com` (required for the in-app download).
- New `autoDownloadUpdates` setting (persisted, default `false`).
- New `src/stores/updateStore.ts` — shared Zustand store that drives the update phase (idle → checking → available → downloading → ready → error) across the banner and the Settings button.
- Added `src/vite-env.d.ts` so `import.meta.env` is correctly typed throughout the project.
- New i18n strings (AR + EN) for all update phases and the new Settings controls.

#### What's New Dialog — Combined 1.1.0–1.1.2
- Replaced the single-version What's New dialog with a combined view that shows every user-facing change across 1.1.0, 1.1.1, and 1.1.2 at once (since the 1.1.1 release never reached users).
- New `seenWhatsNew112` settings flag gates the dialog; dismissing it also marks `seenWhatsNew111` so it does not show twice.

### Changed
- `src/lib/updateCheck.ts` rewritten: removed the manual GitHub API fetch and `isNewer()` helper; replaced with thin wrappers around the plugin's `check()`, `download()`, `install()`, and `relaunch()` APIs.
  - **Why:** The plugin handles version comparison and cryptographic signature verification internally. Keeping both approaches would create two conflicting sources of truth.
  - Download and install are deliberately kept **separate** (not the combined `downloadAndInstall()`) so the restart prompt is always explicit. On Windows, `install()` runs the NSIS installer which closes the process — using the combined form would cause the app to restart mid-download without warning, bypassing the "Restart to install" button entirely.
- `src/components/layout/UpdateBanner.tsx` reworked from a static "visit website" link into a stateful component driven by the update store (phases: available / downloading / ready / error).
- Version bumped to **1.1.2** in `package.json` and `src-tauri/tauri.conf.json`.

---

## [v1.1.1] — 2026-06-02

### Fixed
- **What's New dialog not showing for fresh installs.**
  - **Problem:** The `seenWhatsNew111` flag defaulted to `false` for new users, but the guard condition in `App.tsx` used the old `seenWhatsNew110` key, so new installs launched without seeing the dialog at all.
  - **Solution:** Corrected the flag name to `seenWhatsNew111` and updated `DEFAULT_SETTINGS` accordingly so both upgraders and new installs see the dialog exactly once.
- Minor overlay control-bar polish: improved pause/resume state rendering and timer display in `ControlBar.tsx`.
- Added CSS for the overlay capsule's animated pulse indicator (`src/styles/index.css`).

---

## [v1.1.0] — 2026-06-02

### Added

#### Floating Recording Capsule (Overlay)
- Added a persistent floating control bar that appears at the bottom of the screen during recording. It shows live status, a running timer, and pause/resume/stop/cancel controls, and stays on top of all other windows so users never need to switch back to Warid to manage a recording.
- The capsule is driven by a second Tauri window (`overlay`, transparent, always-on-top) that communicates with the main window over Tauri events (`recording:state`, `overlay:<cmd>`).
- New **Floating Bar** setting (Settings → Preferences) with three modes:
  - **During recording** (default) — capsule appears only while a recording is active.
  - **Always visible** — capsule stays on screen as a quick-launch mic button.
  - **Off** — capsule is never shown.
- Added `src/lib/overlayWindow.ts` (show/hide/state push), `src/lib/overlayCommands.ts` (module-scoped command dispatch so overlay events work from any route).
- Added `src/components/recording/ControlBar.tsx` — the overlay window's UI component.

#### What's New Dialog
- Added a one-time "What's New" modal (`src/components/onboarding/WhatsNew.tsx`) that shows on first launch after upgrading, explaining the new floating capsule and its settings.

### Changed

#### Templates Page — Save Button & Dirty State
- **Problem:** The Save button was buried at the bottom of the editing form with no indication of whether unsaved changes existed. Toggling favorites or deleting templates could leave the editor in an inconsistent state.
- **Solution:** Moved Save to the page header; added `isDirty` tracking (`editing !== original`) to enable/disable it dynamically; relocated "New Template" to the bottom of the sidebar list; fixed favorite/delete actions to correctly reset `original` and `editing` state. (`src/components/templates/TemplatesPage.tsx`)

#### Recorder — Resize Handler & History Refresh
- **Problem:** The waveform visualizer's canvas did not always resize correctly when recording state changed mid-session, and newly completed transcriptions did not appear in History without a manual refresh.
- **Solution:** Added `rs.state` to the resize-handler `useEffect` dependency array; added `useHistoryStore.getState().load()` immediately after successful transcription. (`src/components/recording/Recorder.tsx`)

#### Sidebar Tooltips — Portal Rendering & RTL
- **Problem:** Sidebar tooltips were clipped by the parent container's `overflow: hidden` and did not position correctly in RTL layout.
- **Solution:** Rendered tooltips into `document.body` via React Portal; applied `zIndex: 9999` and backdrop blur; used `translateX(-100%)` offset when `isRTL` is true. (`src/components/layout/Sidebar.tsx`)

#### Select Dropdown — Viewport-Aware Placement
- **Problem:** The custom Select popover opened downward unconditionally, clipping off-screen on small windows (most visible in Settings when the language selector was near the bottom of the viewport).
- **Solution:** Added viewport space detection before rendering; if space below the trigger is less than 190 px and space above is greater, the popover opens upward instead. (`src/components/ui/Select.tsx`)

### Fixed
- Removed unused `Mic` import from `ControlBar.tsx` that was causing TypeScript strict-mode build errors.

---

## [v1.0.1] — 2026-05-31

### Fixed

#### Launch on Startup — Registry Entry Not Saved
- **Problem:** Toggling "Launch on Startup" in Settings appeared to work but the registry entry was never written, so the setting was lost after a restart.
- **Solution:** Rewrote `src/lib/autostart.ts` to call the Tauri autostart plugin synchronously on save. Added a one-time self-heal (guarded by `autostartHealed` flag) that re-applies the registry entry for users who already had the setting enabled, without requiring them to toggle it manually. (`src-tauri/src/lib.rs`, `src/App.tsx`, `src/lib/autostart.ts`)

#### Paste-at-Cursor — Wrong Window Targeted on Windows
- **Problem:** After stopping a recording and auto-pasting the transcript, Ctrl+V was sometimes sent to Warid's own overlay window instead of the user's foreground application.
- **Solution:** Reworked `paste_at_cursor` in `lib.rs` to resolve all Warid-owned HWNDs (main + overlay) and explicitly exclude them when choosing the paste target. Used `AttachThreadInput` to bypass Windows' `SetForegroundWindow` lock. (`src-tauri/src/lib.rs`)

---

## [v1.0.0] — 2026-05-30

### Added

#### Auto Model Selection
- Added an **Auto** model mode that cycles through available free Gemini models in order of capability, falling back to the next if a quota is exhausted. Users no longer need to manually switch models when hitting daily limits. (`src/lib/gemini.ts`, `src/components/settings/SettingsPage.tsx`)
- Per-model daily usage bars shown in Settings → Models.
- One-time migration: existing users are silently moved to Auto mode on first launch after upgrade (guarded by `autoModeMigrated` flag).

#### PDF Export
- Added clean PDF export of transcription results via `jsPDF`. (`src/lib/pdfExporter.ts`)
- "Save as PDF" button added to the transcript result view.

#### Tag-Based Release Workflow
- Replaced the push-to-main CI trigger with a tag-based trigger (`v*`). Releases are now only published when a version tag is pushed, keeping the main branch build-only and the GitHub Releases page clean.
- Added a two-stage workflow: all platform builds create a draft release, then a final `publish-release` job flips it public only if every platform build succeeded.

### Changed
- Warid brand logo applied to all app icons across all platforms and sizes. (`src-tauri/icons/`)
- Global transcribe hotkey changed from `Ctrl+Shift+R` to `Ctrl+Alt+R` to avoid conflicts with common browser shortcuts.

---

## [v0.1.0] — 2026-05-22 (initial development build)

### Added
- Core application structure: Tauri 2 + React 18 + Vite + TypeScript + Zustand + TailwindCSS.
- Audio recording via browser MediaRecorder API; waveform visualizer canvas.
- Transcription pipeline: Gemini API (Google AI Studio) + OpenRouter fallback.
- Template system: create, edit, favourite, and delete prompt templates; per-template global hotkeys.
- History: SQLite-backed transcript storage with search and delete.
- Analytics: word count stats, daily activity heatmap, milestone celebrations.
- Settings: API key management, model selection, theme (light/dark/system), UI language (AR/EN), audio device picker.
- Onboarding flow for first-run API key setup.
- System tray with show/quit menu; tray labels update when UI language changes.
- Auto-paste: after transcription, Ctrl+V is sent to the previously active window.
- GitHub Actions workflow for multi-platform builds (Windows, macOS arm64/x64, Linux).
- Project landing page at `https://mohamedmaslooh.github.io/Warid/`.
