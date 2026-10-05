import { cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly isOn: boolean;
  readonly onChange: (next: boolean) => void;
};

export const FilterChip = ({ label, isOn, onChange }: Props) => (
  <button
    type="button"
    aria-pressed={isOn}
    onClick={() => onChange(!isOn)}
    className={cn(
      'inline-flex h-6 shrink-0 items-center rounded-sm border px-2 text-chip transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      isOn
        ? 'border-transparent bg-selected text-foreground'
        : 'border-border text-muted-foreground hover:bg-hover hover:text-foreground',
    )}
  >
    {label}
  </button>
);
