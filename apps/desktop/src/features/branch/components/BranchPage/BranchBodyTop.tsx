import type { ReactNode } from 'react';
import { PageColumn } from '@goodboy/ui';
import type { Session, SessionProjectMount } from '@goodboy/types';
import type { FixRun } from '../../../resolve/fixRun';
import type { LaneStatus } from '../../../resolve/laneStatus';
import type { BranchControls } from '../../hooks/useBranchControls';
import { BranchNotices } from '../BranchNotices';
import { BranchRunningLine } from '../BranchRunningLine';
import { BranchWorkLines } from '../BranchWorkLines';

type Props = {
  readonly session: Session;
  readonly mount: Pick<SessionProjectMount, 'projectId' | 'branch'> | null;
  readonly isActive: boolean;
  readonly controls: BranchControls;
  readonly review: { readonly run: FixRun | null; readonly lane: LaneStatus | null };
  readonly isFixRunShown: boolean;
  readonly isPushNext: boolean;
  readonly baseRow: ReactNode;
  readonly onOpenComments: () => void;
};

export const BranchBodyTop = ({
  session,
  mount,
  isActive,
  controls,
  review,
  isFixRunShown,
  isPushNext,
  baseRow,
  onOpenComments,
}: Props) => (
  <PageColumn width="column" className="flex shrink-0 flex-col gap-2 pb-3 empty:hidden">
    <BranchRunningLine session={session} mount={mount} isActive={isActive} />
    <BranchWorkLines
      session={session}
      checkWork={controls.checkWork}
      run={review.run}
      lane={review.lane}
      isFixRunShown={isFixRunShown}
      onOpenComments={onOpenComments}
    />
    <BranchNotices sessionId={session.id} controls={controls} isPushNext={isPushNext} />
    {baseRow}
  </PageColumn>
);
