import type { ComponentType } from 'react';

type PluginComponentProps = {
  pluginName: string;
  props?: Record<string, unknown>;
  onAction: (action: string, data?: unknown) => void;
  onClose?: () => void;
  config?: Record<string, unknown>;
  updateConfig?: (path: string, value: unknown) => Promise<void>;
  pluginConfig?: Record<string, unknown>;
  setPluginConfig?: (path: string, value: unknown) => Promise<void>;
};

export type PluginComponent = ComponentType<PluginComponentProps>;

// Maps pluginName → { componentName → React Component }
const registry = new Map<string, Map<string, PluginComponent>>();

export function registerPluginComponents(
  pluginName: string,
  components: Record<string, PluginComponent>,
): void {
  let pluginMap = registry.get(pluginName);
  if (!pluginMap) {
    pluginMap = new Map();
    registry.set(pluginName, pluginMap);
  }
  for (const [name, component] of Object.entries(components)) {
    pluginMap.set(name, component);
  }
}

export function getPluginComponent(
  pluginName: string,
  componentName: string,
): PluginComponent | null {
  return registry.get(pluginName)?.get(componentName) ?? null;
}

export function hasPluginComponents(pluginName: string): boolean {
  return registry.has(pluginName) && (registry.get(pluginName)?.size ?? 0) > 0;
}
