import { useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { Check, ChevronDown } from 'lucide-react';
import { PROVIDER_LABEL } from '../../../chat/utils/chat-constants';
import { POPUP_BASE, POPUP_DOWN, POPUP_UP } from '../dropdown-utils';
import { useClickOutside } from '../../../../shared/hooks/useClickOutside';
import { useDropdownDirection } from '../../../../shared/hooks/useDropdownDirection';

// '' = inherit the session/workspace default provider at run time.
type Value = ProviderId | '';

type Props = {
  value: Value;
  providers: ReadonlyArray<ProviderId>;
  onChange: (value: Value) => void;
  disabled: boolean;
};

const PROVIDER_DOT: Record<ProviderId, string> = {
  anthropic: 'bg-orange-400',
  codex: 'bg-zinc-300',
  cursor: 'bg-sky-400',
  gemini: 'bg-blue-400',
};

function label(value: Value): string {
  return value === '' ? 'Default' : PROVIDER_LABEL[value];
}

export const ProviderSelect = ({ value, providers, onChange, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const direction = useDropdownDirection(containerRef, open);

  const options: ReadonlyArray<Value> = ['', ...providers];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {value === '' ? (
          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
        ) : (
          <span className={cn('size-1.5 shrink-0 rounded-full', PROVIDER_DOT[value])} aria-hidden />
        )}
        <span className="flex-1 truncate font-medium text-foreground">{label(value)}</span>
        <ChevronDown
          size={11}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className={cn(POPUP_BASE, 'min-w-[9rem]', direction === 'up' ? POPUP_UP : POPUP_DOWN)}>
          {options.map((opt) => {
            const active = value === opt;
            return (
              <button
                key={opt === '' ? '__default' : opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {opt === '' ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                    aria-hidden
                  />
                ) : (
                  <span
                    className={cn('size-1.5 shrink-0 rounded-full', PROVIDER_DOT[opt])}
                    aria-hidden
                  />
                )}
                <span className="flex-1 truncate">{label(opt)}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
