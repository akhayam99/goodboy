import { cn, tintClasses } from '@goodboy/ui';
import { needYouWords } from '../needYouWords';

type Props = {
  readonly count: number;
  readonly tone: 'danger' | 'warning';
  readonly variant: 'pill' | 'words';
};

export const WorkspaceAttentionMark = ({ count, tone, variant }: Props) => {
  const tint = tintClasses(tone);
  if (variant === 'pill') {
    return (
      <span
        aria-hidden
        data-workspace-attention={tone}
        className={cn(
          'flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-meta tabular-nums',
          tint.solid,
        )}
      >
        {count}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-workspace-attention={tone}
      className={cn('shrink-0 text-meta tabular-nums', tint.text)}
    >
      {needYouWords({ count })}
    </span>
  );
};
