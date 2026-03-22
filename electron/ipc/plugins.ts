import type { IpcMain } from 'electron';
import type { PluginManager } from '../plugins/plugin-manager.js';

export function registerPluginHandlers(ipcMain: IpcMain, pluginManager: PluginManager): void {
  ipcMain.handle('plugin:get-ui-state', () => {
    return pluginManager.getUIState();
  });

  ipcMain.handle('plugin:list', () => {
    return pluginManager.listPlugins();
  });

  ipcMain.handle('plugin:get-config', (_event, pluginName: string) => {
    return pluginManager.getPluginConfig(pluginName);
  });

  ipcMain.handle('plugin:set-config', (_event, pluginName: string, path: string, value: unknown) => {
    pluginManager.setPluginConfig(pluginName, path, value);
    return { success: true };
  });

  ipcMain.handle('plugin:modal-action', async (_event, pluginName: string, modalId: string, action: string, data?: unknown) => {
    return pluginManager.handleAction({
      pluginName,
      targetId: modalId,
      action,
      data,
    });
  });

  ipcMain.handle('plugin:banner-action', async (_event, pluginName: string, bannerId: string, action: string, data?: unknown) => {
    return pluginManager.handleAction({
      pluginName,
      targetId: bannerId,
      action,
      data,
    });
  });

  // Generic plugin action dispatch (for settings sections and any plugin-defined targets)
  ipcMain.handle('plugin:action', async (_event, pluginName: string, targetId: string, action: string, data?: unknown) => {
    return pluginManager.handleAction({
      pluginName,
      targetId,
      action,
      data,
    });
  });
}
