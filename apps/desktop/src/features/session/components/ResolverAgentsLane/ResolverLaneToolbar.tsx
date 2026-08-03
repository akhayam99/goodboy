import { Play } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { PendingResolutionsStrip } from '../../../context/components/ContextPanel/strips/PendingResolutionsStrip';

type Props = {
  readonly sessionId: SessionId;
  readonly queuedCount: number;
  readonly isStalled: boolean;
  readonly onForceNext: () => void;
};

export const ResolverLaneToolbar = ({ sessionId, queuedCount, isStalled, onForceNext }: Props) => {
  const hasPending = useAppStore(
    (s) => (s.sessionPendingResolutions[sessionId] ?? EMPTY_ARRAY).length > 0,
  );

  if (!hasPending && !isStalled) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <PendingResolutionsStrip sessionId={sessionId} />
      {isStalled && (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onForceNext}
            title="the current resolver has not committed or explained yet; run the next queued one anyway"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-3xs font-medium text-warning transition-colors hover:bg-warning/20"
          >
            <Play size={9} aria-hidden />
            Run next ({queuedCount})
          </button>
        </div>
      )}
    </div>
  );
};
