import { usePlugins } from '@/providers/PluginProvider';

export type PluginSettingsSection = {
  key: string;
  label: string;
  pluginName: string;
  component: string;
  priority: number;
};

export function usePluginSettingsSections(): PluginSettingsSection[] {
  const { uiState } = usePlugins();

  if (!uiState) return [];

  return uiState.settingsSections.map((s) => ({
    key: `plugin:${s.pluginName}:${s.id}`,
    label: s.label,
    pluginName: s.pluginName,
    component: s.component,
    priority: s.priority ?? 0,
  }));
}
