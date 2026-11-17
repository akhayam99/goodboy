import type { ComponentProps } from 'react';
import type { PullRequestHost, SessionId } from '@goodboy/types';
import type { FixRun } from '../../fixRun';
import type { FixRunReady } from '../../fixRunReady';
import type { LaneStatus } from '../../laneStatus';
import type { BulkRun } from './bulkRun';
import { FixRunChecks } from './FixRunChecks';
import { FixRunCount } from './FixRunCount';
import { FixRunReadyCount } from './FixRunReadyCount';
import { ReviewScopeBar } from './ReviewScopeBar';
import { RunStatusBulkActions } from './RunStatusBulkActions';

type Props = Omit<ComponentProps<typeof ReviewScopeBar>, 'trailing'> & {
  readonly sessionId: SessionId;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
  readonly bulkRun: BulkRun | null;
  readonly ready: FixRunReady | null;
  readonly sourceKind: PullRequestHost | null;
  readonly isChecksShown: boolean;
  readonly onOpenAnswers: () => void;
};

export const ReviewToolbar = ({
  sessionId,
  run,
  lane,
  bulkRun,
  ready,
  sourceKind,
  isChecksShown,
  onOpenAnswers,
  ...bar
}: Props) => (
  <>
    <ReviewScopeBar
      {...bar}
      trailing={
        run === null ? null : (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {bulkRun === null ? null : (
              <RunStatusBulkActions
                sessionId={sessionId}
                run={bulkRun}
                onOpenAnswers={onOpenAnswers}
              />
            )}
            <FixRunCount sessionId={sessionId} run={run} lane={lane} />
            {ready === null ? null : <FixRunReadyCount ready={ready} sourceKind={sourceKind} />}
          </div>
        )
      }
    />
    {run === null || !isChecksShown ? null : (
      <FixRunChecks sessionId={sessionId} agentId={run.agentId} />
    )}
  </>
);
