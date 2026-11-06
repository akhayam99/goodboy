import type { MountId, Session } from '@goodboy/types';
import { FixRunSection } from '../../resolve/components/ReviewFlow/FixRunSection';
import type { FixRun } from '../../resolve/fixRun';
import type { LaneStatus } from '../../resolve/laneStatus';
import type { BranchCheckWork } from '../hooks/useBranchCheckStep';
import { BranchCheckWorkLine } from './BranchCheckWorkLine';
import { BranchRunsLine } from './BranchRunsLine';

type Props = {
  readonly session: Session;
  readonly mountId: MountId | null;
  readonly mountPath: string | null;
  readonly checkWork: BranchCheckWork;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
  readonly isFixRunShown: boolean;
  readonly onOpenComments: () => void;
};

export const BranchWorkLines = ({
  session,
  mountId,
  mountPath,
  checkWork,
  run,
  lane,
  isFixRunShown,
  onOpenComments,
}: Props) => (
  <>
    {mountId === null ? null : (
      <BranchRunsLine session={session} mountId={mountId} mountPath={mountPath} />
    )}
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
