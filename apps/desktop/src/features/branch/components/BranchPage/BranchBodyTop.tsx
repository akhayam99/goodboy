import type { ReactNode } from 'react';
import { PageColumn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import type { BranchControls } from '../../hooks/useBranchControls';
import { BranchNotices } from '../BranchNotices';

type Props = {
  readonly session: Session;
  readonly controls: BranchControls;
  readonly isPushNext: boolean;
  readonly isSetupOfferShown: boolean;
  readonly baseRow: ReactNode;
};

export const BranchBodyTop = ({
  session,
  controls,
  isPushNext,
  isSetupOfferShown,
  baseRow,
}: Props) => (
  <PageColumn width="column" className="flex shrink-0 flex-col gap-2 pb-3 empty:hidden">
    <BranchNotices
      sessionId={session.id}
      controls={controls}
      isPushNext={isPushNext}
      isSetupOfferShown={isSetupOfferShown}
    />
    {baseRow}
  </PageColumn>
);
