import type { ComponentProps } from 'react';
import type { SessionId } from '@goodboy/types';
import type { FixRun } from '../../fixRun';
import type { LaneStatus } from '../../laneStatus';
import type { BulkRun } from './bulkRun';
import { FixRunChecks } from './FixRunChecks';
import { FixRunSection } from './FixRunSection';
import { ReviewScopeBar } from './ReviewScopeBar';

type Props = Omit<ComponentProps<typeof ReviewScopeBar>, 'trailing'> & {
  readonly sessionId: SessionId;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
  readonly bulkRun: BulkRun | null;
  readonly isChecksShown: boolean;
  readonly onOpenAnswers: () => void;
};

export const ReviewToolbar = ({
  sessionId,
  run,
  lane,
  bulkRun,
  isChecksShown,
  onOpenAnswers,
  ...bar
}: Props) => (
  <>
    <ReviewScopeBar
      {...bar}
      trailing={
        run === null ? null : (
          <FixRunSection
            sessionId={sessionId}
            run={run}
            lane={lane}
            bulkRun={bulkRun}
            isChecksShown={false}
            onOpenAnswers={onOpenAnswers}
          />
        )
      }
    />
    {run === null || !isChecksShown ? null : (
      <FixRunChecks sessionId={sessionId} agentId={run.agentId} />
    )}
  </>
);
