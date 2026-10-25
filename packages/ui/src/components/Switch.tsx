import type { ReactNode } from 'react';
import { cn } from '../cn';
import { DISABLED } from '../disabledStyle';
import { FOCUS_RING } from '../focusRing';

export type SwitchProps = {
  readonly label?: ReactNode;
  readonly ariaLabel?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (next: boolean) => void;
  readonly className?: string;
};

export const Switch = ({
  label,
  ariaLabel,
  checked,
  disabled,
  onChange,
  className,
}: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'inline-flex min-h-6 items-center gap-2 rounded-full px-2 py-1 text-meta transition-colors',
      FOCUS_RING,
      checked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      disabled && cn(DISABLED, 'hover:text-disabled-foreground'),
      className,
    )}
  >
    <span
      className={cn(
        'relative h-4 w-7 shrink-0 rounded-full transition-colors',
        disabled !== true && checked && 'bg-primary',
        disabled !== true && !checked && 'bg-idle',
        disabled === true && checked && 'bg-disabled-foreground',
        disabled === true && !checked && 'bg-fill',
      )}
      aria-hidden
    >
      <span
        className={cn(
          'absolute top-0.5 size-3 rounded-full bg-background shadow-sm motion-safe:transition-all',
          checked ? 'left-3.5' : 'left-0.5',
        )}
      />
    </span>
    {label}
  </button>
);
