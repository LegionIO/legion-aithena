import { useState, type FC } from 'react';
import { PlusIcon, Trash2Icon, PencilIcon, XIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import { EditableInput } from '@/components/EditableInput';
import { EditableTextarea } from '@/components/EditableTextarea';
import { Toggle, SliderField, settingsSelectClass, type SettingsProps } from './shared';

type ProfileEntry = {
  key: string;
  name: string;
  primaryModelKey: string;
  fallbackModelKeys: string[];
  systemPrompt?: string;
  temperature?: number;
  maxSteps?: number;
  maxRetries?: number;
  useResponsesApi?: boolean;
  reasoningEffort?: string;
};

type CatalogModel = {
  key: string;
  displayName: string;
};

export const ProfileSettings: FC<SettingsProps> = ({ config, updateConfig }) => {
  const profiles = (config.profiles as ProfileEntry[] | undefined) ?? [];
  const models = ((config.models as { catalog?: CatalogModel[] })?.catalog ?? []) as CatalogModel[];
  const defaultProfileKey = config.defaultProfileKey as string | undefined;

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const updateProfiles = (next: ProfileEntry[]) => updateConfig('profiles', next);
  const addProfile = (p: ProfileEntry) => updateProfiles([...profiles, p]);
  const updateProfile = (i: number, p: ProfileEntry) => {
    const next = [...profiles];
    next[i] = p;
    updateProfiles(next);
  };
  const deleteProfile = (i: number) => {
    const deleted = profiles[i];
    const next = profiles.filter((_, idx) => idx !== i);
    updateProfiles(next);
    if (deleted && defaultProfileKey === deleted.key) {
      updateConfig('defaultProfileKey', undefined);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold">Profiles</h3>
      <p className="text-xs text-muted-foreground">
        Profiles bundle a primary model, fallback chain, system prompt, and LLM parameters into named presets.
        Select a profile per-conversation in the composer area.
      </p>

      {/* Default profile selector */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Default Profile</label>
        <select
          className={settingsSelectClass}
          value={defaultProfileKey ?? ''}
          onChange={(e) => updateConfig('defaultProfileKey', e.target.value || undefined)}
        >
          <option value="">None (use global settings)</option>
          {profiles.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Profile list */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profile List</h4>
        {profiles.map((profile, i) =>
          editIndex === i ? (
            <ProfileForm
              key={`edit-${i}`}
              initial={profile}
              models={models}
              onSave={(p) => { updateProfile(i, p); setEditIndex(null); }}
              onCancel={() => setEditIndex(null)}
              submitLabel="Save"
            />
          ) : (
            <ProfileCard
              key={profile.key}
              profile={profile}
              models={models}
              onEdit={() => setEditIndex(i)}
              onDelete={() => deleteProfile(i)}
            />
          ),
        )}
      </div>

      {showAdd ? (
        <ProfileForm
          initial={{ key: '', name: '', primaryModelKey: models[0]?.key ?? '', fallbackModelKeys: [] }}
          models={models}
          onSave={(p) => { addProfile(p); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
          submitLabel="Add Profile"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors w-full"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Profile
        </button>
      )}
    </div>
  );
};

const ProfileCard: FC<{
  profile: ProfileEntry;
  models: CatalogModel[];
  onEdit: () => void;
  onDelete: () => void;
}> = ({ profile, models, onEdit, onDelete }) => {
  const primaryModel = models.find((m) => m.key === profile.primaryModelKey);
  const fallbackCount = profile.fallbackModelKeys.length;

  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{profile.name}</span>
          <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
            {primaryModel?.displayName ?? profile.primaryModelKey}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
          <span className="font-mono">{profile.key}</span>
          {fallbackCount > 0 && (
            <span>{fallbackCount} fallback{fallbackCount > 1 ? 's' : ''}</span>
          )}
          {profile.temperature !== undefined && (
            <span>temp {profile.temperature}</span>
          )}
          {profile.systemPrompt && (
            <span>custom prompt</span>
          )}
        </div>
      </div>
      <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-muted transition-colors" title="Edit">
        <PencilIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button type="button" onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete">
        <Trash2Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
};

const ProfileForm: FC<{
  initial: ProfileEntry;
  models: CatalogModel[];
  onSave: (entry: ProfileEntry) => void;
  onCancel: () => void;
  submitLabel: string;
}> = ({ initial, models, onSave, onCancel, submitLabel }) => {
  const [key, setKey] = useState(initial.key);
  const [name, setName] = useState(initial.name);
  const [primaryModelKey, setPrimaryModelKey] = useState(initial.primaryModelKey);
  const [fallbackModelKeys, setFallbackModelKeys] = useState<string[]>(initial.fallbackModelKeys);
  const [systemPrompt, setSystemPrompt] = useState(initial.systemPrompt ?? '');
  const [temperature, setTemperature] = useState<number | undefined>(initial.temperature);
  const [maxSteps, setMaxSteps] = useState<number | undefined>(initial.maxSteps);
  const [maxRetries, setMaxRetries] = useState<number | undefined>(initial.maxRetries);
  const [useResponsesApi, setUseResponsesApi] = useState(initial.useResponsesApi ?? false);
  const [reasoningEffort, setReasoningEffort] = useState(initial.reasoningEffort ?? '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canSave = key.trim() && name.trim() && primaryModelKey;

  const handleNameChange = (v: string) => {
    const wasAuto = !initial.key || key === toKey(initial.name);
    setName(v);
    if (wasAuto) setKey(toKey(v));
  };

  const handleSave = () => {
    if (!canSave) return;
    const entry: ProfileEntry = {
      key: key.trim(),
      name: name.trim(),
      primaryModelKey,
      fallbackModelKeys,
    };
    if (systemPrompt.trim()) entry.systemPrompt = systemPrompt.trim();
    if (temperature !== undefined) entry.temperature = temperature;
    if (maxSteps !== undefined) entry.maxSteps = maxSteps;
    if (maxRetries !== undefined) entry.maxRetries = maxRetries;
    if (useResponsesApi) entry.useResponsesApi = true;
    if (reasoningEffort) entry.reasoningEffort = reasoningEffort;
    onSave(entry);
  };

  const toggleFallback = (modelKey: string) => {
    if (fallbackModelKeys.includes(modelKey)) {
      setFallbackModelKeys(fallbackModelKeys.filter((k) => k !== modelKey));
    } else {
      setFallbackModelKeys([...fallbackModelKeys, modelKey]);
    }
  };

  const moveFallback = (index: number, direction: -1 | 1) => {
    const next = [...fallbackModelKeys];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setFallbackModelKeys(next);
  };

  const availableFallbacks = models.filter((m) => m.key !== primaryModelKey);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Name + Key */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Profile Name</label>
          <EditableInput
            className="w-full rounded border bg-background px-2 py-1 text-xs"
            value={name}
            onChange={handleNameChange}
            placeholder="Fast Coding"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Key (unique ID)</label>
          <EditableInput
            className="w-full rounded border bg-background px-2 py-1 text-xs font-mono"
            value={key}
            onChange={setKey}
            placeholder="fast-coding"
          />
        </div>
      </div>

      {/* Primary Model */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Primary Model</label>
        <select
          className={settingsSelectClass.replace('bg-card/80', 'bg-background')}
          value={primaryModelKey}
          onChange={(e) => {
            setPrimaryModelKey(e.target.value);
            // Remove from fallbacks if it was there
            setFallbackModelKeys(fallbackModelKeys.filter((k) => k !== e.target.value));
          }}
        >
          {models.map((m) => (
            <option key={m.key} value={m.key}>{m.displayName}</option>
          ))}
        </select>
      </div>

      {/* Fallback Models */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">Fallback Models (in order)</label>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          If the primary model fails, these are tried in order.
        </p>

        {/* Selected fallbacks with reorder */}
        {fallbackModelKeys.length > 0 && (
          <div className="space-y-1 mb-2">
            {fallbackModelKeys.map((fbKey, i) => {
              const model = models.find((m) => m.key === fbKey);
              return (
                <div key={fbKey} className="flex items-center gap-1.5 rounded border bg-background/50 px-2 py-1">
                  <span className="text-[10px] text-muted-foreground font-mono w-4">{i + 1}.</span>
                  <span className="text-xs flex-1 truncate">{model?.displayName ?? fbKey}</span>
                  <button
                    type="button"
                    onClick={() => moveFallback(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <ChevronUpIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFallback(i, 1)}
                    disabled={i === fallbackModelKeys.length - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <ChevronDownIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFallback(fbKey)}
                    className="p-0.5 rounded hover:bg-destructive/10 transition-colors"
                    title="Remove"
                  >
                    <XIcon className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Available models to add */}
        <div className="flex flex-wrap gap-1.5">
          {availableFallbacks
            .filter((m) => !fallbackModelKeys.includes(m.key))
            .map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleFallback(m.key)}
                className="rounded-lg border border-dashed px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                + {m.displayName}
              </button>
            ))}
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-0.5">System Prompt Override</label>
        <EditableTextarea
          className="w-full h-[80px] rounded border bg-background p-2 text-xs font-mono overflow-y-auto outline-none focus:ring-1 focus:ring-ring"
          value={systemPrompt}
          onChange={setSystemPrompt}
          placeholder="Leave blank to use global system prompt"
        />
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[10px] text-primary hover:underline"
      >
        {showAdvanced ? 'Hide advanced parameters' : 'Show advanced parameters'}
      </button>

      {showAdvanced && (
        <div className="space-y-2 border-t pt-2">
          {/* Temperature */}
          <div>
            <SliderField
              label={`Temperature: ${temperature ?? 'inherit global'}`}
              value={temperature ?? 0.4}
              min={0}
              max={2}
              step={0.1}
              onChange={(v) => setTemperature(v)}
            />
            <button
              type="button"
              onClick={() => setTemperature(undefined)}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              Reset to inherit
            </button>
          </div>

          {/* Max Steps */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Max Steps</label>
            <input
              type="number"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none"
              value={maxSteps ?? ''}
              onChange={(e) => setMaxSteps(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Inherit global"
              min={1}
              max={50}
            />
          </div>

          {/* Max Retries */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Max Retries</label>
            <input
              type="number"
              className="w-full rounded border bg-background px-2 py-1 text-xs outline-none"
              value={maxRetries ?? ''}
              onChange={(e) => setMaxRetries(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Inherit global"
              min={0}
              max={10}
            />
          </div>

          {/* Reasoning Effort */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Default Reasoning Effort</label>
            <select
              className={settingsSelectClass.replace('bg-card/80', 'bg-background')}
              value={reasoningEffort}
              onChange={(e) => setReasoningEffort(e.target.value)}
            >
              <option value="">Inherit (medium)</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="xhigh">Extra High</option>
            </select>
          </div>

          {/* Use Responses API */}
          <Toggle
            label="Use Responses API"
            checked={useResponsesApi}
            onChange={setUseResponsesApi}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs font-medium disabled:opacity-40 transition-colors hover:bg-primary/90"
        >
          <CheckIcon className="h-3 w-3" />
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-xs hover:bg-muted/80 transition-colors"
        >
          <XIcon className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </div>
  );
};

function toKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
