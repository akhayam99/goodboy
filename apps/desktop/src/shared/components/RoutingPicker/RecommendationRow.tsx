import { cn } from '@goodboy/ui';

type Props = {
  readonly summary: string;
  readonly active: boolean;
  readonly reason?: string;
  readonly onSelect: () => void;
};

export const RecommendationRow = ({ summary, active, reason, onSelect }: Props) => (
  <div className="flex flex-col gap-1">
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
    {reason != null && reason !== '' ? (
      <p className="px-2.5 pb-1.5 text-2xs leading-relaxed text-muted-foreground/80">{reason}</p>
    ) : null}
  </div>
);
