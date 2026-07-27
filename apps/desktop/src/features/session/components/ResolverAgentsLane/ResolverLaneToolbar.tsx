import { ArrowUpRight, Play } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { PendingResolutionsStrip } from '../../../context/components/ContextPanel/strips/PendingResolutionsStrip';

type Props = {
  readonly sessionId: SessionId;
  readonly prNumber: number | null;
  readonly queuedCount: number;
  readonly isStalled: boolean;
  readonly onForceNext: () => void;
  readonly onOpenPr: () => void;
};

export const ResolverLaneToolbar = ({
  sessionId,
  prNumber,
  queuedCount,
  isStalled,
  onForceNext,
  onOpenPr,
}: Props) => (
  <div className="flex flex-col gap-2">
    <PendingResolutionsStrip sessionId={sessionId} />
    {(isStalled || prNumber !== null) && (
      <div className="flex items-center justify-end gap-1">
        {isStalled && (
          <button
            type="button"
            onClick={onForceNext}
            title="the current resolver has not committed or explained yet; run the next queued one anyway"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning transition-colors hover:bg-warning/20"
          >
            <Play size={9} aria-hidden />
            Run next ({queuedCount})
          </button>
        )}
        {prNumber !== null && (
          <button
            type="button"
            onClick={onOpenPr}
            title="open the pull request in studio"
            aria-label="open the pull request in studio"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            Open PR
            <ArrowUpRight size={10} aria-hidden />
          </button>
        )}
      </div>
    )}
  </div>
);
