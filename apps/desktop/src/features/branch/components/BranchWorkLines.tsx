import type { Session } from '@goodboy/types';
import { FixRunSection } from '../../resolve/components/ReviewFlow/FixRunSection';
import type { FixRun } from '../../resolve/fixRun';
import type { LaneStatus } from '../../resolve/laneStatus';
import type { BranchCheckWork } from '../hooks/useBranchCheckStep';
import { BranchCheckWorkLine } from './BranchCheckWorkLine';

type Props = {
  readonly session: Session;
  readonly checkWork: BranchCheckWork;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
  readonly isFixRunShown: boolean;
  readonly onOpenComments: () => void;
};

export const BranchWorkLines = ({
  session,
  checkWork,
  run,
  lane,
  isFixRunShown,
  onOpenComments,
}: Props) => (
  <>
    {checkWork.agentId === null ? null : (
      <BranchCheckWorkLine
        sessionId={session.id}
        agentId={checkWork.agentId}
        isFixing={checkWork.chain === 'fixing'}
        checkName={checkWork.checkName}
      />
    )}
    {!isFixRunShown || run === null ? null : (
      <FixRunSection
        sessionId={session.id}
        run={run}
        lane={lane}
        bulkRun={null}
        isChecksShown={false}
        onOpenAnswers={onOpenComments}
      />
    )}
  </>
);
