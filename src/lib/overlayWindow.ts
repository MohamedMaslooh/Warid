import { getAllWebviewWindows, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { currentMonitor, PhysicalPosition } from "@tauri-apps/api/window";

export type OverlayBarState = "recording" | "processing" | "idle";

export interface OverlayState {
  state: OverlayBarState;
  paused: boolean;
  duration: number;
}

async function getOverlay(): Promise<WebviewWindow | null> {
  const all = await getAllWebviewWindows();
  return all.find((w) => w.label === "overlay") ?? null;
}

/** Show the floating control bar pinned to the bottom-center of the primary monitor. */
export async function showOverlay(): Promise<void> {
  const overlay = await getOverlay();
  if (!overlay) return;
  try {
    await overlay.setShadow(false);
    await overlay.setAlwaysOnTop(true);
    await overlay.setSkipTaskbar(true);
    await positionBottomCenter(overlay);
    await overlay.show();
  } catch (err) {
    console.warn("Failed to show overlay", err);
  }
}

export async function hideOverlay(): Promise<void> {
  const overlay = await getOverlay();
  if (!overlay) return;
  try {
    await overlay.hide();
  } catch (err) {
    console.warn("Failed to hide overlay", err);
  }
}

/** Push the current recording state to the overlay. */
export async function pushOverlayState(state: OverlayState): Promise<void> {
  try {
    await emit("recording:state", state);
  } catch (err) {
    console.warn("Failed to push overlay state", err);
  }
}

async function positionBottomCenter(overlay: WebviewWindow): Promise<void> {
  const monitor = await currentMonitor();
  if (!monitor) return;
  const size = await overlay.outerSize();
  const scale = monitor.scaleFactor;
  const marginBottom = Math.round(16 * scale);
  const x = Math.round(monitor.position.x + (monitor.size.width - size.width) / 2);
  const y = Math.round(
    monitor.position.y + monitor.size.height - size.height - marginBottom
  );
  await overlay.setPosition(new PhysicalPosition(x, y));
}
