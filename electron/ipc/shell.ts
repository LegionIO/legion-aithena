import type { IpcMain } from 'electron';
import { shell } from 'electron';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

export function registerShellHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('shell:open-path', async (_event, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return { ok: false, error: 'Path is required' };
    }

    const rawTarget = filePath.trim();
    const target = rawTarget === '~' || rawTarget.startsWith('~/')
      ? rawTarget.replace(/^~/, homedir())
      : rawTarget;
    if (!existsSync(target)) {
      return { ok: false, error: 'Path does not exist' };
    }

    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  });
}
