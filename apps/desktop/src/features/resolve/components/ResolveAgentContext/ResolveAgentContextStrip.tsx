import { ArrowLeft } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useResolveQueueRows } from '../../hooks/useResolveQueueRows';
import { RESOLVE_QUEUE_STATUS_LABEL, sharedRunHeading } from '../../resolveQueueCopy';
import { RESOLVE_ITEM_LABEL } from '../../resolveItemCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly prNumber: number;
};

export const ResolveAgentContextStrip = ({ sessionId, threadId, prNumber }: Props) => {
  const returnFromResolveAgent = useAppStore((s) => s.returnFromResolveAgent);
  const rows = useResolveQueueRows({ sessionId });
  const row = rows.find((candidate) => candidate.thread.threadId === threadId) ?? null;
  const coveredCount = row === null ? 0 : row.coveredThreadIds.length;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-1.5">
      <button
        type="button"
        onClick={() => returnFromResolveAgent({ sessionId })}
        className="flex min-w-0 items-center gap-1.5 rounded-full border border-border-soft px-2.5 py-1 text-2xs text-muted-foreground motion-safe:transition-colors hover:text-foreground"
      >
        <ArrowLeft size={ICON_SIZE.row} aria-hidden />
        <span className="shrink-0">{RESOLVE_ITEM_LABEL.backToComment}</span>
      </button>
      <span className="min-w-0 truncate text-2xs text-muted-foreground">
        PR #{prNumber}
        {row !== null && ` · ${RESOLVE_QUEUE_STATUS_LABEL[row.status]}`}
        {coveredCount > 0 && ` · ${sharedRunHeading({ count: coveredCount + 1 })}`}
      </span>
    </div>
  );
};
