import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { ComputerOverlayState } from '../../shared/computer-use.js';

const overlayWindows = new Map<string, BrowserWindow>();

function loadOverlayRoute(win: BrowserWindow, query: Record<string, string>): void {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  const rendererHtmlPath = join(__dirname, '../renderer/index.html');

  if (rendererUrl) {
    const targetUrl = new URL(rendererUrl);
    for (const [key, value] of Object.entries(query)) {
      targetUrl.searchParams.set(key, value);
    }
    void win.loadURL(targetUrl.toString());
    return;
  }

  void win.loadFile(rendererHtmlPath, { query });
}

function safelySend(win: BrowserWindow, channel: string, data: unknown): void {
  try {
    if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  } catch {
    // Window or frame was disposed between our check and the send — ignore.
  }
}

/**
 * Create a fullscreen overlay BrowserWindow that covers the entire display
 * (including menu bar and dock areas) so the cursor indicator can reach
 * any screen coordinate. Uses enableLargerThanScreen to bypass macOS
 * constraints that would otherwise clip the window to the work area.
 */
export function createOverlayWindow(
  sessionId: string,
  _config: { position: 'top' | 'bottom'; heightPx: number; opacity: number },
): BrowserWindow {
  closeOverlayWindow(sessionId);

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

  const preloadPath = join(__dirname, '../preload/index.mjs');
  const win = new BrowserWindow({
    x: screenX,
    y: screenY,
    width: screenWidth,
    height: screenHeight,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    enableLargerThanScreen: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Click-through so user can interact with the desktop underneath
  win.setIgnoreMouseEvents(true, { forward: true });

  // Place above all normal windows, menu bar, and dock
  win.setAlwaysOnTop(true, 'screen-saver');

  // Force full-display bounds (bypass work area constraints)
  win.setBounds({ x: screenX, y: screenY, width: screenWidth, height: screenHeight });

  // Exclude from window menu and app switcher
  win.excludedFromShownWindowsMenu = true;

  loadOverlayRoute(win, { overlay: '1', sessionId });

  win.once('ready-to-show', () => {
    win.showInactive();
  });

  win.on('closed', () => {
    overlayWindows.delete(sessionId);
  });

  overlayWindows.set(sessionId, win);
  return win;
}

/**
 * Send updated session state to the overlay's renderer process.
 */
export function updateOverlayState(sessionId: string, state: ComputerOverlayState): void {
  const win = overlayWindows.get(sessionId);
  if (!win || win.isDestroyed()) return;
  safelySend(win, 'computer-use:overlay-state', state);
}

/**
 * Hide the overlay window completely from the compositor.
 * This ensures screencapture will NOT capture it.
 * Returns a Promise that resolves after the compositor has processed the hide.
 */
export async function hideOverlayForCapture(sessionId: string): Promise<void> {
  const win = overlayWindows.get(sessionId);
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  win.hide();
  // Wait one+ compositor frame so the window is fully removed from macOS window server
  await new Promise((resolve) => setTimeout(resolve, 32));
}

/**
 * Re-show the overlay after a screenshot capture completes.
 */
export function showOverlayAfterCapture(sessionId: string): void {
  const win = overlayWindows.get(sessionId);
  if (!win || win.isDestroyed()) return;
  win.showInactive();
}

/**
 * Destroy an overlay window. Uses `win.destroy()` instead of `win.close()`
 * because the window is non-closable by the user (no close button).
 */
export function closeOverlayWindow(sessionId: string): void {
  const win = overlayWindows.get(sessionId);
  overlayWindows.delete(sessionId);
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
}

/**
 * Destroy all overlay windows. Called during app quit to ensure
 * no orphaned overlay windows persist.
 */
export function closeAllOverlayWindows(): void {
  for (const [sessionId, win] of overlayWindows) {
    overlayWindows.delete(sessionId);
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
}

export function hasOverlayWindow(sessionId: string): boolean {
  const win = overlayWindows.get(sessionId);
  return Boolean(win && !win.isDestroyed());
}
