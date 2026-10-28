import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { FixRun } from '../../fixRun';
import type { LaneStatus } from '../../laneStatus';
import type { BulkRun } from './bulkRun';
import { FixRunChecks } from './FixRunChecks';
import { ResolveRunStatus } from './ResolveRunStatus';
import { RunStatusBulkActions } from './RunStatusBulkActions';

type Props = {
  readonly sessionId: SessionId;
  readonly run: FixRun;
  readonly lane: LaneStatus | null;
  readonly bulkRun: BulkRun | null;
  readonly isChecksShown: boolean;
  readonly onOpenAnswers: () => void;
};

export const FixRunSection = ({
  sessionId,
  run,
  lane,
  bulkRun,
  isChecksShown,
  onOpenAnswers,
}: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
  const stopResolveLane = useAppStore((s) => s.stopResolveLane);
  const isTranscriptOpen = useAppStore(
    (s) =>
      s.drawer?.kind === 'transcript' &&
      s.drawer.sessionId === sessionId &&
      s.drawer.payload.agentId === run.agentId,
  );
  return (
    <>
      <ResolveRunStatus
        run={run}
        onOpenTranscript={
          isTranscriptOpen
            ? null
            : () =>
                openDrawer({
                  kind: 'transcript',
                  sessionId,
                  payload: { agentId: run.agentId },
                })
        }
        lane={lane}
        onStop={() =>
          void (lane === null
            ? forceCloseResolver(sessionId, run.agentId)
            : stopResolveLane({ sessionId, worktreePath: lane.worktreePath }))
        }
        actions={
          bulkRun === null ? null : (
            <RunStatusBulkActions
              sessionId={sessionId}
              run={bulkRun}
              onOpenAnswers={onOpenAnswers}
            />
          )
        }
      />
      {isChecksShown ? <FixRunChecks sessionId={sessionId} agentId={run.agentId} /> : null}
    </>
  );
};
