import type { SessionId } from '@goodboy/types';
import { FixRunSection } from '../../resolve/components/ReviewFlow/FixRunSection';
import type { FixRun } from '../../resolve/fixRun';
import type { LaneStatus } from '../../resolve/laneStatus';
import type { BranchCheckWork } from '../hooks/useBranchCheckStep';
import { BranchCheckWorkLine } from './BranchCheckWorkLine';

type Props = {
  readonly sessionId: SessionId;
  readonly checkWork: BranchCheckWork;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
  readonly isFixRunShown: boolean;
  readonly onOpenComments: () => void;
};

export const BranchWorkLines = ({
  sessionId,
  checkWork,
  run,
  lane,
  isFixRunShown,
  onOpenComments,
}: Props) => (
  <>
    {checkWork.agentId === null ? null : (
      <BranchCheckWorkLine
        sessionId={sessionId}
        agentId={checkWork.agentId}
        isFixing={checkWork.chain === 'fixing'}
        checkName={checkWork.checkName}
      />
    )}
    {!isFixRunShown || run === null ? null : (
      <FixRunSection
        sessionId={sessionId}
        run={run}
        lane={lane}
        bulkRun={null}
        isChecksShown={false}
        onOpenAnswers={onOpenComments}
      />
    )}
  </>
);
