import type { SessionId } from '@goodboy/types';
import { ErrorStrip } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { LaneRebuildFailure } from '../../../../store/slices/resolve/state';
import { LANE_REBUILD_FAILED_LABEL } from '../../laneCopy';
import type { LaneStatus } from '../../laneStatus';

type Props = {
  readonly sessionId: SessionId;
  readonly lane: LaneStatus | null;
};

const NO_FAILURES: ReadonlyArray<LaneRebuildFailure> = [];

export const LaneNotices = ({ sessionId, lane }: Props) => {
  const failures = useAppStore((s) => s.sessionLaneRebuildFailures[sessionId] ?? NO_FAILURES);
  const retryLaneRebuild = useAppStore((s) => s.retryLaneRebuild);
  return (
    <>
      {failures.map((failure) => (
        <ErrorStrip
          key={failure.worktreePath}
          label={LANE_REBUILD_FAILED_LABEL}
          error={new Error(failure.message)}
          onRetry={() =>
            void retryLaneRebuild({
              sessionId,
              worktreePath: failure.worktreePath,
              mountId: failure.mountId,
            })
          }
        />
      ))}
      {lane?.rebuildLine != null && (
        <p role="status" className="text-meta text-muted-foreground">
          {lane.rebuildLine}
        </p>
      )}
    </>
  );
};
