import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { NAMES } from '../../../../shared/utils/names';
import { elapsedWordOf } from '../../central/board/boardRowWordsOf';
import { SessionCostChip } from './SessionCostChip';

type Props = {
  readonly sessionId: SessionId;
  readonly status: string | null;
  readonly elapsedMs: number;
};

export const OverviewStatus = ({ sessionId, status, elapsedMs }: Props) => {
  const summaryAt = useAppStore((state) => state.summarizerStatus[sessionId]?.lastUpdate ?? null);
  const openContextDrawer = useAppStore((state) => state.openContextDrawer);
  return (
    <div data-overview-status="" className="flex min-w-0 flex-col gap-1">
      {status === null ? null : <p className="min-w-0 text-prose text-foreground">{status}</p>}
      <div
        data-overview-facts=""
        className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-muted-foreground"
      >
        <span className="flex min-w-0">
          <SessionCostChip sessionId={sessionId} />
        </span>
        {elapsedMs > 0 ? (
          <span className="tabular-nums">{elapsedWordOf({ elapsedMs })} agent time</span>
        ) : null}
        {summaryAt === null ? null : (
          <Button
            variant="quiet"
            size="sm"
            className="font-normal text-muted-foreground"
            onClick={() => openContextDrawer({ sessionId, section: 'summary' })}
          >
            {NAMES.summaryAge}, <RelativeTime iso={summaryAt} />
          </Button>
        )}
      </div>
    </div>
  );
};
