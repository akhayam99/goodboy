import { cn } from '@goodboy/ui';

type Props = {
  readonly additions: number;
  readonly deletions: number;
  readonly isMuted?: boolean;
};

export const Delta = ({ additions, deletions, isMuted = false }: Props) => (
  <span
    data-tone={isMuted ? 'muted' : 'diff'}
    className="flex shrink-0 gap-1 text-meta tabular-nums"
  >
    <span className={cn(isMuted ? 'text-faint-foreground' : 'text-success')}>+{additions}</span>
    <span className={cn(isMuted ? 'text-faint-foreground' : 'text-danger')}>−{deletions}</span>
  </span>
);
