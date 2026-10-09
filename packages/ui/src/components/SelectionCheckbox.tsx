import type { MouseEvent } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { Tooltip } from './Tooltip';
import { ICON_SIZE } from '../iconSize';

export type SelectionCheckboxProps = {
  readonly checked: boolean;
  readonly label: string;
  readonly onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly disabled?: boolean;
  readonly isAlwaysShown?: boolean;
  readonly className?: string;
};

export const SelectionCheckbox = ({
  checked,
  label,
  onToggle,
  disabled = false,
  isAlwaysShown = false,
  className,
}: SelectionCheckboxProps) => (
  <Tooltip
    content={label}
    anchorClassName={cn(
      'z-10 flex size-5 shrink-0 motion-safe:transition-opacity',
      isAlwaysShown || checked
        ? 'opacity-100'
        : 'opacity-0 focus-within:opacity-100 group-focus-within/select-row:opacity-100 group-hover/select-row:opacity-100 group-data-[selecting=true]/select-list:opacity-100',
      disabled && 'opacity-50',
      className,
    )}
  >
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      data-selection-checkbox
      disabled={disabled}
      tabIndex={-1}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event);
      }}
      className={cn(
        'flex size-5 items-center justify-center rounded-md',
        FOCUS_RING,
        disabled && 'cursor-not-allowed',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-4 items-center justify-center rounded-md border motion-safe:transition-colors',
          checked
            ? 'border-primary bg-primary text-on-tone'
            : 'border-border bg-background hover:border-foreground',
        )}
      >
        {checked ? <Check size={ICON_SIZE.row} strokeWidth={3} /> : null}
      </span>
    </button>
  </Tooltip>
);
