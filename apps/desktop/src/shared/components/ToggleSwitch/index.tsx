import { cn } from '@goodboy/ui';

type ToggleSwitchProps = {
  readonly label: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly beta?: boolean;
  readonly onChange: (next: boolean) => void;
};

export const ToggleSwitch = ({ label, checked, disabled, beta, onChange }: ToggleSwitchProps) => (
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
    {beta ? (
      <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
        beta
      </span>
    ) : null}
  </button>
);
