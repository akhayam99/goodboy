import { cn } from '@goodboy/ui';

type Props = {
  readonly additions: number;
  readonly deletions: number;
  readonly size?: 'inherit' | 'sm' | 'md';
};

const SIZE_CLASS: Record<'inherit' | 'sm' | 'md', string> = {
  inherit: '',
  sm: 'text-3xs',
  md: 'text-xs',
};

export const DiffStat = ({ additions, deletions, size = 'sm' }: Props) => {
  if (additions === 0 && deletions === 0) {
    return null;
  }
  return (
    <span
      data-testid="diff-stat"
      className={cn('flex shrink-0 items-center gap-1 tabular-nums', SIZE_CLASS[size])}
    >
      {additions === 0 ? null : <span className="text-success/80">{`+${additions}`}</span>}
      {deletions === 0 ? null : <span className="text-danger/80">{`-${deletions}`}</span>}
    </span>
  );
};
