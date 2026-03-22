import type { FC } from 'react';
import { ChevronUpIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import { Toggle, NumberField, SliderField, settingsSelectClass, type SettingsProps } from './shared';

type FallbackConfig = {
  enabled: boolean;
  modelKeys: string[];
};

type CatalogModel = {
  key: string;
  displayName: string;
};

export const AdvancedSettings: FC<SettingsProps> = ({ config, updateConfig }) => {
  const advanced = config.advanced as {
    temperature: number;
    maxSteps: number;
    maxRetries: number;
    useResponsesApi: boolean;
  };
  const titleGen = config.titleGeneration as {
    enabled: boolean;
    retitleIntervalMessages: number;
    retitleEagerUntilMessage: number;
  };
  const ui = config.ui as { theme: string; sidebarWidth: number };
  const fallback = (config.fallback as FallbackConfig | undefined) ?? { enabled: false, modelKeys: [] };
  const models = ((config.models as { catalog?: CatalogModel[] })?.catalog ?? []) as CatalogModel[];

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold">Advanced</h3>

      <fieldset className="rounded-lg border p-3 space-y-3">
        <legend className="text-xs font-semibold px-1">LLM Parameters</legend>
        <SliderField label={`Temperature: ${advanced.temperature}`} value={advanced.temperature} min={0} max={2} step={0.1} onChange={(v) => updateConfig('advanced.temperature', v)} />
        <div className="flex justify-between text-[10px] text-muted-foreground -mt-2">
          <span>Focused &amp; predictable</span>
          <span>Creative &amp; varied</span>
        </div>
        <NumberField label="Max Steps (tool call loops)" value={advanced.maxSteps} onChange={(v) => updateConfig('advanced.maxSteps', v)} min={1} max={50} />
        <NumberField label="Max Retries" value={advanced.maxRetries} onChange={(v) => updateConfig('advanced.maxRetries', v)} min={0} max={10} />
        <Toggle label="Use Responses API" checked={advanced.useResponsesApi} onChange={(v) => updateConfig('advanced.useResponsesApi', v)} />
      </fieldset>

      <fieldset className="rounded-lg border p-3 space-y-3">
        <legend className="text-xs font-semibold px-1">Model Fallback</legend>
        <p className="text-xs text-muted-foreground">
          When enabled and the primary model fails before producing content, the system tries the next model in the chain.
          This is a global fallback chain used when no profile-specific chain is configured.
        </p>
        <Toggle
          label="Enable global fallback chain"
          checked={fallback.enabled}
          onChange={(v) => updateConfig('fallback.enabled', v)}
        />
        {fallback.enabled && (
          <FallbackModelList
            selectedKeys={fallback.modelKeys}
            catalog={models}
            onChange={(keys) => updateConfig('fallback.modelKeys', keys)}
          />
        )}
      </fieldset>

      <fieldset className="rounded-lg border p-3 space-y-3">
        <legend className="text-xs font-semibold px-1">AI Conversation Titles</legend>

        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div>
            <span className="text-xs font-medium">Auto-generate titles</span>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Automatically generate and refresh conversation titles using AI.</p>
          </div>
          <input type="checkbox" checked={titleGen.enabled} onChange={(e) => updateConfig('titleGeneration.enabled', e.target.checked)} className="mt-0.5 h-4 w-4 rounded" />
        </div>

        <NumberField label="Title refresh interval (messages)" value={titleGen.retitleIntervalMessages} onChange={(v) => updateConfig('titleGeneration.retitleIntervalMessages', Math.max(1, v || 1))} min={1} />
        <p className="text-[10px] text-muted-foreground -mt-2">Regenerate title every N user messages after the eager window.</p>

        <NumberField label="Always refresh for first N messages" value={titleGen.retitleEagerUntilMessage} onChange={(v) => updateConfig('titleGeneration.retitleEagerUntilMessage', Math.max(0, v || 0))} min={0} />
        <p className="text-[10px] text-muted-foreground -mt-2">Always regenerate the title for each user message up to this count (eager phase).</p>
      </fieldset>

      <fieldset className="rounded-lg border p-3 space-y-3">
        <legend className="text-xs font-semibold px-1">UI</legend>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Theme</label>
          <select className={settingsSelectClass} value={ui.theme} onChange={(e) => updateConfig('ui.theme', e.target.value)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </fieldset>
    </div>
  );
};

const FallbackModelList: FC<{
  selectedKeys: string[];
  catalog: CatalogModel[];
  onChange: (keys: string[]) => void;
}> = ({ selectedKeys, catalog, onChange }) => {
  const toggleModel = (key: string) => {
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter((k) => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  };

  const moveModel = (index: number, direction: -1 | 1) => {
    const next = [...selectedKeys];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-muted-foreground block">Fallback order (tried top to bottom):</label>
      {selectedKeys.length > 0 && (
        <div className="space-y-1">
          {selectedKeys.map((key, i) => {
            const model = catalog.find((m) => m.key === key);
            return (
              <div key={key} className="flex items-center gap-1.5 rounded border bg-card/50 px-2 py-1">
                <span className="text-[10px] text-muted-foreground font-mono w-4">{i + 1}.</span>
                <span className="text-xs flex-1 truncate">{model?.displayName ?? key}</span>
                <button type="button" onClick={() => moveModel(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors" title="Move up">
                  <ChevronUpIcon className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => moveModel(i, 1)} disabled={i === selectedKeys.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors" title="Move down">
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => toggleModel(key)} className="p-0.5 rounded hover:bg-destructive/10 transition-colors" title="Remove">
                  <XIcon className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {catalog
          .filter((m) => !selectedKeys.includes(m.key))
          .map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => toggleModel(m.key)}
              className="rounded-lg border border-dashed px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              + {m.displayName}
            </button>
          ))}
      </div>
    </div>
  );
};
