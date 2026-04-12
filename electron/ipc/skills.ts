/**
 * skills IPC handlers — delegates all skill operations to the Legion daemon.
 *
 * All skill execution, registration, and state management is now daemon-side.
 * This file exposes read-only list/describe and cancel operations only.
 */
import type { IpcMain } from 'electron';

const DAEMON_URL = process.env.LEGION_DAEMON_URL ?? 'http://localhost:4567';

export function registerSkillsHandlers(ipcMain: IpcMain, _appHome: string): void {
  ipcMain.handle('skills:list', async () => {
    const res = await fetch(`${DAEMON_URL}/api/skills`);
    if (!res.ok) throw new Error(`skills:list failed: ${res.status}`);
    return res.json();
  });

  ipcMain.handle('skills:get', async (_event, name: string) => {
    const [ns, nm] = name.includes(':') ? name.split(':', 2) : ['default', name];
    const res = await fetch(`${DAEMON_URL}/api/skills/${encodeURIComponent(ns)}/${encodeURIComponent(nm)}`);
    if (!res.ok) return { error: `Skill "${name}" not found.` };
    return res.json();
  });

  // skills:delete and skills:toggle are no longer supported; skills are managed daemon-side
  ipcMain.handle('skills:delete', async (_event, _name: string) => {
    return { error: 'Skill deletion must be performed via the Legion daemon.' };
  });

  ipcMain.handle('skills:toggle', async (_event, _name: string, _enable: boolean) => {
    return { error: 'Skill toggling must be performed via the Legion daemon.' };
  });

  ipcMain.handle('skills:cancel', async (_event, conversationId: string) => {
    const res = await fetch(
      `${DAEMON_URL}/api/skills/active/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error(`skills:cancel failed: ${res.status}`);
    return res.json();
  });
}
