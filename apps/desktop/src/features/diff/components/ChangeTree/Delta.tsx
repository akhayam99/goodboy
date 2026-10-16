import { cn } from '@goodboy/ui';

type Props = {
  readonly additions: number;
  readonly deletions: number;
  readonly isMuted?: boolean;
};

export const Delta = ({ additions, deletions, isMuted = false }: Props) => (
  <span
    data-tone={isMuted ? 'muted' : 'diff'}
    data-slot="tree-delta"
    className="grid shrink-0 grid-cols-[2.5rem_2.5rem] text-right text-meta tabular-nums"
  >
    <span className={cn('truncate', isMuted ? 'text-faint-foreground' : 'text-success')}>
      {additions === 0 ? '' : `+${additions}`}
    </span>
    <span className={cn('truncate', isMuted ? 'text-faint-foreground' : 'text-danger')}>
      {deletions === 0 ? '' : `−${deletions}`}
    </span>
  </span>
);
