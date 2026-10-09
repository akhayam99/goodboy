import type { ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '../cn';
import { ICON_SIZE } from '../iconSize';

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
      'inline-flex items-center gap-1 text-label text-foreground',
      disabled ? 'cursor-not-allowed text-disabled-foreground' : 'cursor-pointer',
      className,
    )}
  >
    <span
      data-slot="checkbox-hit-area"
      className="relative inline-flex size-6 shrink-0 items-center justify-center"
    >
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
          'peer size-4 cursor-pointer appearance-none rounded-sm border border-border bg-background transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:bg-fill',
          indeterminate === true && 'border-primary bg-primary',
        )}
      />
      {checked && indeterminate !== true ? (
        <Check
          size={ICON_SIZE.row}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto text-background"
        />
      ) : null}
      {indeterminate === true ? (
        <Minus
          size={ICON_SIZE.row}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto text-background"
        />
      ) : null}
    </span>
    {label}
  </label>
);
