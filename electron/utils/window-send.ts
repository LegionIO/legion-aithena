import { BrowserWindow } from 'electron';

export function safelySendToWindow(win: BrowserWindow, channel: string, data?: unknown): boolean {
  try {
    if (win.isDestroyed()) return false;

    const { webContents } = win;
    if (!webContents || webContents.isDestroyed() || webContents.isLoadingMainFrame()) {
      return false;
    }

    webContents.send(channel, data);
    return true;
  } catch {
    // Windows can disappear between checks and send calls during startup/shutdown.
    return false;
  }
}

export function broadcastToAllWindows(channel: string, data?: unknown): number {
  let sentCount = 0;
  for (const win of BrowserWindow.getAllWindows()) {
    if (safelySendToWindow(win, channel, data)) {
      sentCount += 1;
    }
  }
  return sentCount;
}
