import { useState, useEffect, type FC } from 'react';
import type { SettingsProps } from './shared';
import { Toggle, SliderField, settingsSelectClass } from './shared';

type AudioConfig = {
  tts?: {
    enabled?: boolean;
    voice?: string;
    rate?: number;
  };
  dictation?: {
    enabled?: boolean;
    language?: string;
    continuous?: boolean;
  };
};

export const AudioSettings: FC<SettingsProps> = ({ config, updateConfig }) => {
  const audio = (config as Record<string, unknown>).audio as AudioConfig | undefined;
  const tts = audio?.tts;
  const dictation = audio?.dictation;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load available OS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) setVoices(available);
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Audio</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure text-to-speech and voice dictation using your operating system&apos;s built-in speech services.
        </p>
      </div>

      {/* ── Text-to-Speech ── */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text-to-Speech</h4>

        <Toggle
          label="Enable text-to-speech"
          checked={tts?.enabled ?? true}
          onChange={(v) => updateConfig('audio.tts.enabled', v)}
        />

        {(tts?.enabled ?? true) && (
          <div className="space-y-3 pl-1">
            {/* Voice Selection */}
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Voice</label>
              <select
                className={settingsSelectClass}
                value={tts?.voice ?? ''}
                onChange={(e) => updateConfig('audio.tts.voice', e.target.value || undefined)}
              >
                <option value="">System Default</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              {voices.length === 0 && (
                <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                  No voices available — your OS may still be loading them.
                </span>
              )}
            </div>

            {/* Rate Slider */}
            <SliderField
              label={`Speed: ${(tts?.rate ?? 1).toFixed(1)}x`}
              value={tts?.rate ?? 1}
              min={0.5}
              max={3}
              step={0.1}
              onChange={(v) => updateConfig('audio.tts.rate', v)}
            />
          </div>
        )}
      </div>

      {/* ── Dictation ── */}
      <div className="space-y-3 border-t border-border/50 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dictation</h4>

        <Toggle
          label="Enable voice dictation"
          checked={dictation?.enabled ?? true}
          onChange={(v) => updateConfig('audio.dictation.enabled', v)}
        />

        {(dictation?.enabled ?? true) && (
          <div className="space-y-3 pl-1">
            {/* Language */}
            <div>
              <label className="text-[10px] text-muted-foreground block mb-0.5">Language (BCP-47)</label>
              <input
                type="text"
                className="w-full rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-xs outline-none"
                value={dictation?.language ?? 'en-US'}
                onChange={(e) => updateConfig('audio.dictation.language', e.target.value)}
                placeholder="en-US"
              />
              <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                e.g. en-US, en-GB, es-ES, fr-FR, de-DE, ja-JP
              </span>
            </div>

            {/* Continuous */}
            <Toggle
              label="Continuous listening"
              checked={dictation?.continuous ?? true}
              onChange={(v) => updateConfig('audio.dictation.continuous', v)}
            />
            <span className="text-[10px] text-muted-foreground/60 block -mt-2 pl-1">
              Keep the microphone active between pauses instead of stopping after each phrase.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
