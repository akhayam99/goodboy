import { cn } from '@goodboy/ui';

type BranchMode = 'new' | 'existing';

type Props = {
  readonly mode: BranchMode;
  readonly onChange: (next: BranchMode) => void;
  readonly disabled: boolean;
};

export const BranchModeToggle = ({ mode, onChange, disabled }: Props) => {
  const modes: ReadonlyArray<{ id: BranchMode; label: string }> = [
    { id: 'new', label: 'New' },
    { id: 'existing', label: 'Existing' },
  ];
  return (
    <div
      role="tablist"
      aria-label="branch source"
      className="inline-flex shrink-0 rounded border border-border bg-background p-0.5"
    >
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={cn(
              'rounded px-2 py-0.5 text-2xs font-medium motion-safe:transition-colors',
              active
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
};
