import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly provider: string;
  readonly icon: LucideIcon;
  readonly identifier: string;
  readonly title: string;
  readonly state: string;
  readonly isSelected: boolean;
  readonly onClick: () => void;
};

export const PrListRow = ({
  provider,
  icon: Icon,
  identifier,
  title,
  state,
  isSelected,
  onClick,
}: Props) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={isSelected ? 'true' : undefined}
    className={cn(
      'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
      isSelected
        ? 'border-accent/40 bg-accent/5 ring-1 ring-accent/20'
        : 'border-border-soft bg-elevated hover:border-border',
    )}
  >
    <span role="img" aria-label={provider} className="shrink-0 text-accent">
      <Icon size={13} aria-hidden />
    </span>
    <span className="shrink-0 font-mono text-2xs font-semibold text-foreground">{identifier}</span>
    <span className="min-w-0 flex-1 truncate text-xs text-foreground">{title}</span>
    <span className="shrink-0 text-2xs text-muted-foreground">{state}</span>
  </button>
);
