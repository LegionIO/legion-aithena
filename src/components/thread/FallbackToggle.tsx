import type { FC } from 'react';
import { ShuffleIcon } from 'lucide-react';

export const FallbackToggle: FC<{
  enabled: boolean;
  onToggle: (value: boolean) => void;
}> = ({ enabled, onToggle }) => (
  <button
    type="button"
    onClick={() => onToggle(!enabled)}
    title={enabled ? 'Auto-routing enabled (click to disable)' : 'Enable auto-routing (fallback)'}
    className={`flex h-[30px] items-center gap-1.5 rounded-xl border px-2.5 text-xs transition-colors ${
      enabled
        ? 'border-primary/50 bg-primary/10 text-primary'
        : 'border-border/70 bg-card/70 text-muted-foreground hover:bg-muted/50'
    }`}
  >
    <ShuffleIcon className="h-3 w-3" />
    <span className="font-medium">{enabled ? 'Auto' : 'Manual'}</span>
  </button>
);
