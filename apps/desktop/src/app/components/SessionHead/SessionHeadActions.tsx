import type { Session } from '@goodboy/types';
import { OverviewHeaderActions } from '../../../features/session/components/SessionOverviewPane/OverviewHeaderActions';
import { SessionHeaderActions } from '../SessionActions/SessionHeaderActions';

type Props = {
  readonly session: Session;
  readonly isDetail: boolean;
};

export const SessionHeadActions = ({ session, isDetail }: Props) => (
  <>
    <OverviewHeaderActions session={session} />
    <SessionHeaderActions session={session} isMenuShown={!isDetail} />
  </>
);
