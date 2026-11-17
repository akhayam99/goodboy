import type { Session } from '@goodboy/types';
import { FixRunSection } from '../../resolve/components/ReviewFlow/FixRunSection';
import type { FixRun } from '../../resolve/fixRun';
import type { LaneStatus } from '../../resolve/laneStatus';

type Props = {
  readonly session: Session;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
  readonly isFixRunShown: boolean;
  readonly onOpenComments: () => void;
};

export const BranchWorkLines = ({ session, run, lane, isFixRunShown, onOpenComments }: Props) =>
  !isFixRunShown || run === null ? null : (
    <FixRunSection
      sessionId={session.id}
      run={run}
      lane={lane}
      bulkRun={null}
      isChecksShown={false}
      onOpenAnswers={onOpenComments}
    />
  );
