import { type FC } from 'react';
import { XIcon } from 'lucide-react';
import { usePlugins } from '@/providers/PluginProvider';
import { getPluginComponent } from './PluginComponentRegistry';
import { useConfig } from '@/providers/ConfigProvider';

export const PluginModalHost: FC = () => {
  const { uiState, sendModalAction, setPluginConfig, rendererLoadCount } = usePlugins();
  const { config, updateConfig } = useConfig();

  // rendererLoadCount changes when a plugin's renderer script finishes loading,
  // which ensures we re-render and pick up newly registered components
  void rendererLoadCount;

  if (!uiState) return null;

  const visibleModals = uiState.modals.filter((m) => m.visible);
  if (visibleModals.length === 0) return null;

  return (
    <>
      {visibleModals.map((modal) => {
        const Component = getPluginComponent(modal.pluginName, modal.component);

        const handleClose = () => {
          if (modal.closeable) {
            sendModalAction(modal.pluginName, modal.id, 'close');
          }
        };

        const handleAction = (action: string, data?: unknown) => {
          sendModalAction(modal.pluginName, modal.id, action, data);
        };

        return (
          <div
            key={`${modal.pluginName}-${modal.id}`}
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={modal.title ?? 'Plugin dialog'}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={modal.closeable ? handleClose : undefined}
              onKeyDown={modal.closeable ? (e) => { if (e.key === 'Escape') handleClose(); } : undefined}
              role={modal.closeable ? 'button' : undefined}
              tabIndex={modal.closeable ? -1 : undefined}
            />

            {/* Modal content */}
            <div className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl">
              {/* Close button (only if closeable) */}
              {modal.closeable && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute right-4 top-4 rounded-xl p-1.5 hover:bg-muted transition-colors"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}

              {/* Title */}
              {modal.title && (
                <h2 className="mb-4 text-lg font-semibold">{modal.title}</h2>
              )}

              {/* Plugin component or fallback */}
              {Component ? (
                <Component
                  pluginName={modal.pluginName}
                  props={modal.props}
                  onAction={handleAction}
                  onClose={modal.closeable ? handleClose : undefined}
                  config={config ?? undefined}
                  updateConfig={updateConfig}
                  pluginConfig={undefined}
                  setPluginConfig={async (path, value) => {
                    await setPluginConfig(modal.pluginName, path, value);
                  }}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Plugin component &quot;{modal.component}&quot; not found for plugin &quot;{modal.pluginName}&quot;.</p>
                  <p className="mt-1 text-xs">Ensure the plugin&apos;s UI components are registered.</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
