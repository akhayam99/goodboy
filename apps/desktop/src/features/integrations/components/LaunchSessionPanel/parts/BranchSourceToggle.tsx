import { cn } from '@goodboy/ui';

type Mode = 'adopt' | 'fresh';

type Props = {
  readonly mode: Mode;
  readonly adoptLabel: string;
  readonly disabled: boolean;
  readonly onChange: (next: Mode) => void;
};

export const BranchSourceToggle = ({ mode, adoptLabel, disabled, onChange }: Props) => {
  const options: ReadonlyArray<{ readonly id: Mode; readonly label: string }> = [
    { id: 'adopt', label: adoptLabel },
    { id: 'fresh', label: 'Start fresh' },
  ];
  return (
    <div
      role="tablist"
      aria-label="branch source"
      className="inline-flex shrink-0 rounded-md border border-border bg-background p-0.5 text-2xs"
    >
      {options.map((option) => {
        const isActive = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded px-2 py-1 font-medium motion-safe:transition-colors',
              isActive
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
