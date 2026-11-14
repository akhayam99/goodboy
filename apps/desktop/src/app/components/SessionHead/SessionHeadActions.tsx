import type { Session } from '@goodboy/types';
import { OverviewHeaderActions } from '../../../features/session/components/SessionOverviewPane/OverviewHeaderActions';
import { SessionHeaderActions } from '../SessionActions/SessionHeaderActions';
import { AskButton } from './AskButton';

type Props = {
  readonly session: Session;
};

export const SessionHeadActions = ({ session }: Props) => (
  <>
    <OverviewHeaderActions session={session} />
    <AskButton sessionId={session.id} />
    <SessionHeaderActions session={session} />
  </>
);
