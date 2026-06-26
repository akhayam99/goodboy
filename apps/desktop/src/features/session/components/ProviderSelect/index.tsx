import { useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { Check, ChevronDown } from 'lucide-react';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { PROVIDER_LABEL } from '../../../chat/utils/chat-constants';
import { POPUP_BASE, POPUP_DOWN, POPUP_UP } from '../dropdown-utils';
import { useClickOutside } from '../../../../shared/hooks/useClickOutside';
import { useDropdownDirection } from '../../../../shared/hooks/useDropdownDirection';

type Value = ProviderId | '';

type Props = {
  value: Value;
  providers: ReadonlyArray<ProviderId>;
  onChange: (value: Value) => void;
  disabled: boolean;
  recommended?: ProviderId;
};

const ProviderGlyph = ({ id }: { id: ProviderId }) => {
  const Icon = PROVIDER_BRAND[id].icon;
  return <Icon size={13} className="shrink-0" style={{ color: brandColor(id) }} aria-hidden />;
};

const AutoTag = () => (
  <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/70">
    recommended
  </span>
);

export const ProviderSelect = ({ value, providers, onChange, disabled, recommended }: Props) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const direction = useDropdownDirection(containerRef, open);

  const options: ReadonlyArray<Value> = ['', ...providers.filter((p) => p !== recommended)];

  const renderOption = (opt: Value) => {
    if (opt !== '') {
      return (
        <>
          <ProviderGlyph id={opt} />
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {PROVIDER_LABEL[opt]}
          </span>
        </>
      );
    }
    if (recommended) {
      return (
        <>
          <ProviderGlyph id={recommended} />
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {PROVIDER_LABEL[recommended]}
          </span>
          <AutoTag />
        </>
      );
    }
    return (
      <>
        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">Default</span>
      </>
    );
  };

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
        {renderOption(value)}
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
                {renderOption(opt)}
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
