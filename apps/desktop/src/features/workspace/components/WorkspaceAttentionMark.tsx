import { CountBadge, cn, tintClasses } from '@goodboy/ui';
import { needYouWords } from '../needYouWords';

type Props = {
  readonly count: number;
  readonly tone: 'danger' | 'warning';
  readonly variant: 'pill' | 'words';
};

export const WorkspaceAttentionMark = ({ count, tone, variant }: Props) => {
  if (variant === 'pill') {
    return (
      <span data-workspace-attention={tone} className="flex shrink-0">
        <CountBadge count={count} tone={tone} isAnnounced={false} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-workspace-attention={tone}
      className={cn('shrink-0 text-meta tabular-nums', tintClasses(tone).text)}
    >
      {needYouWords({ count })}
    </span>
  );
};
