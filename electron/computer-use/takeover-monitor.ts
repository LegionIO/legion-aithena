import {
  startLocalMacosTakeoverMonitor as startNativeMonitor,
  type LocalMacosTakeoverEvent,
  type LocalMacosTakeoverMonitorHandle,
} from './harnesses/local-macos.js';
import { resolveMaterializedHelperPath } from './permissions.js';

export type { LocalMacosTakeoverEvent };

type Listener = {
  onEvent: (event: LocalMacosTakeoverEvent) => void;
  onError?: (message: string) => void;
};

let activeMonitor: LocalMacosTakeoverMonitorHandle | null = null;
let activeListener: Listener | null = null;
let restartTimer: NodeJS.Timeout | null = null;
let shouldRun = false;

function clearRestartTimer(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function scheduleRestart(): void {
  if (!shouldRun || !activeListener || restartTimer) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (shouldRun && activeListener) {
      startMonitor(activeListener);
    }
  }, 1200);
}

function startMonitor(listener: Listener): void {
  clearRestartTimer();
  resolveMaterializedHelperPath();
  const monitor = startNativeMonitor({
    onEvent: listener.onEvent,
    onError: (message) => listener.onError?.(message),
  });

  activeMonitor = monitor;
  activeListener = listener;

  monitor.process.on('exit', (code, signal) => {
    if (activeMonitor?.process === monitor.process) {
      activeMonitor = null;
    }
    if (!shouldRun) return;
    listener.onError?.(`Local macOS takeover monitor exited (${signal ?? code ?? 'unknown'}).`);
    scheduleRestart();
  });
}

export function startLocalMacosTakeoverMonitor(listener: Listener): void {
  shouldRun = true;
  activeListener = listener;
  if (activeMonitor && !activeMonitor.process.killed) {
    return;
  }
  startMonitor(listener);
}

export function stopLocalMacosTakeoverMonitor(): void {
  shouldRun = false;
  clearRestartTimer();
  activeListener = null;
  activeMonitor?.stop();
  activeMonitor = null;
}
