import { InlineMarkdown, cn } from '@goodboy/ui';
import type { SessionRowTitle as RowTitle } from '../../session/sessionTitle';

type Props = RowTitle & {
  readonly className?: string;
  readonly titleClassName?: string;
};

export const SessionRowTitle = ({ keys, title, className, titleClassName }: Props) => (
  <span className={cn('flex min-w-0 items-baseline gap-2', className)}>
    {keys.length === 0 ? null : (
      <span
        data-testid="session-row-keys"
        className="shrink-0 font-mono text-meta text-muted-foreground"
      >
        {keys.join(' ')}
      </span>
    )}
    <InlineMarkdown text={title} className={cn('min-w-0 flex-1', titleClassName)} />
  </span>
);
