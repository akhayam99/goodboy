import type { ReactNode } from 'react';
import { cn } from '../cn';

export type SwitchProps = {
  readonly label: ReactNode;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (next: boolean) => void;
  readonly className?: string;
};

export const Switch = ({ label, checked, disabled, onChange, className }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs transition-colors',
      checked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      disabled && 'cursor-not-allowed opacity-50',
      className,
    )}
  >
    <span
      className={cn(
        'relative h-4 w-7 shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/25',
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
