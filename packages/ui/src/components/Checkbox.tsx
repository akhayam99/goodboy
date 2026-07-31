import type { ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '../cn';

export type CheckboxProps = {
  readonly label?: ReactNode;
  readonly checked: boolean;
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
  readonly onChange: (next: boolean) => void;
  readonly ariaLabel?: string;
  readonly id?: string;
  readonly className?: string;
};

export const Checkbox = ({
  label,
  checked,
  indeterminate,
  disabled,
  onChange,
  ariaLabel,
  id,
  className,
}: CheckboxProps) => (
  <label
    className={cn(
      'inline-flex items-center gap-2 text-xs text-foreground',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      className,
    )}
  >
    <span className="relative inline-flex size-3.5 shrink-0">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
        ref={(el) => {
          if (el != null) {
            el.indeterminate = indeterminate === true;
          }
        }}
        className={cn(
          'peer absolute inset-0 size-3.5 cursor-pointer appearance-none rounded-md border border-border-soft bg-background transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed',
          indeterminate === true && 'border-primary bg-primary',
        )}
      />
      {checked && indeterminate !== true ? (
        <Check
          size={11}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto text-background"
        />
      ) : null}
      {indeterminate === true ? (
        <Minus
          size={11}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto text-background"
        />
      ) : null}
    </span>
    {label}
  </label>
);
