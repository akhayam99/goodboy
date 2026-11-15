import type { Session } from '@goodboy/types';
import { OverviewHeaderActions } from '../../../features/session/components/SessionOverviewPane/OverviewHeaderActions';
import { SessionHeaderActions } from '../SessionActions/SessionHeaderActions';
import { AskButton } from './AskButton';

type Props = {
  readonly session: Session;
  readonly isDetail: boolean;
};

export const SessionHeadActions = ({ session, isDetail }: Props) => (
  <>
    <OverviewHeaderActions session={session} />
    <AskButton sessionId={session.id} />
    <SessionHeaderActions session={session} isMenuShown={!isDetail} />
  </>
);
