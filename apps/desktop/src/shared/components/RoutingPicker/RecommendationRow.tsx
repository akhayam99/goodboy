import { cn } from '@goodboy/ui';

type Props = {
  readonly summary: string;
  readonly active: boolean;
  readonly onSelect: () => void;
};

export const RecommendationRow = ({ summary, active, onSelect }: Props) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={active}
    className={cn(
      'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-xs transition-colors',
      active
        ? 'bg-background font-medium text-foreground'
        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
    )}
  >
    <span>Recommended</span>
    <span className="truncate text-2xs text-muted-foreground/70">{summary}</span>
  </button>
);
