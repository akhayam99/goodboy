import { useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import { Check, ChevronDown } from 'lucide-react';
import {
  VERBOSITY_LABEL,
  VERBOSITY_LEVELS,
  VERBOSITY_DOT,
  type VerbosityLevel,
} from '../../../settings/verbosity';
import { POPUP_BASE, POPUP_DOWN, POPUP_UP } from '../dropdown-utils';
import { useClickOutside } from '../../../../shared/hooks/useClickOutside';
import { useDropdownDirection } from '../../../../shared/hooks/useDropdownDirection';

type Props = {
  value: VerbosityLevel;
  onChange: (level: VerbosityLevel) => void;
  disabled: boolean;
};

export const VerbositySelect = ({ value, onChange, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const direction = useDropdownDirection(containerRef, open);

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
        <span className={cn('size-1.5 shrink-0 rounded-full', VERBOSITY_DOT[value])} aria-hidden />
        <span className="flex-1 truncate font-medium text-foreground">
          {VERBOSITY_LABEL[value]}
        </span>
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
        <div className={cn(POPUP_BASE, 'min-w-[7rem]', direction === 'up' ? POPUP_UP : POPUP_DOWN)}>
          {VERBOSITY_LEVELS.map((level) => {
            const active = value === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  onChange(level);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', VERBOSITY_DOT[level])}
                  aria-hidden
                />
                <span className="flex-1">{VERBOSITY_LABEL[level]}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
