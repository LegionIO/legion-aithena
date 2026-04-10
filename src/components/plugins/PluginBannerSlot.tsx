import type { FC } from 'react';
import { ShieldAlertIcon, InfoIcon, AlertTriangleIcon, XIcon } from 'lucide-react';
import { usePlugins } from '@/providers/PluginProvider';
import { getPluginComponent } from './PluginComponentRegistry';
import { useConfig } from '@/providers/ConfigProvider';

export const PluginBannerSlot: FC = () => {
  const { uiState, sendBannerAction } = usePlugins();
  const { config, updateConfig } = useConfig();

  if (!uiState) return null;

  const visibleBanners = uiState.banners.filter((b) => b.visible);
  if (visibleBanners.length === 0) return null;

  return (
    <div className="space-y-1 px-4 pt-2">
      {visibleBanners.map((banner) => {
        // If the banner has a custom component, render it
        if (banner.component) {
          const Component = getPluginComponent(banner.pluginName, banner.component);
          if (Component) {
            return (
              <Component
                key={`${banner.pluginName}-${banner.id}`}
                pluginName={banner.pluginName}
                props={banner.props}
                onAction={(action, data) => sendBannerAction(banner.pluginName, banner.id, action, data)}
                config={config ?? undefined}
                updateConfig={updateConfig}
              />
            );
          }
        }

        // Default inline banner
        const variant = banner.variant ?? 'info';
        const variantStyles = {
          info: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
          warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400',
          error: 'bg-destructive/10 border-destructive/20 text-destructive',
        };
        const Icon = variant === 'error' ? ShieldAlertIcon : variant === 'warning' ? AlertTriangleIcon : InfoIcon;

        return (
          <div
            key={`${banner.pluginName}-${banner.id}`}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${variantStyles[variant]}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-xs">{banner.text ?? ''}</span>
            {banner.dismissible !== false && (
              <button
                type="button"
                onClick={() => sendBannerAction(banner.pluginName, banner.id, 'dismiss')}
                className="shrink-0 p-0.5"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
