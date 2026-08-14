import { cn, Popover, useDropdown } from '@goodboy/ui';
import { Check, ChevronDown } from 'lucide-react';
import {
  VERBOSITY_LABEL,
  VERBOSITY_LEVELS,
  VERBOSITY_DOT,
  type VerbosityLevel,
} from '../../../settings/verbosity';

type Props = {
  value: VerbosityLevel;
  onChange: (level: VerbosityLevel) => void;
  disabled: boolean;
};

export const VerbositySelect = ({ value, onChange, disabled }: Props) => {
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({ disabled });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
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
      {open && (
        <Popover
          role="listbox"
          ariaLabel="Reply verbosity"
          className={cn(popupClassName, 'py-0.5')}
        >
          {VERBOSITY_LEVELS.map((level) => {
            const active = value === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  onChange(level);
                  close();
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
        </Popover>
      )}
    </div>
  );
};
