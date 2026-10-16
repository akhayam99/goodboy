import type { Session } from '@goodboy/types';
import { ArchivedRestore } from './ArchivedRestore';
import { OverviewPageActions } from './OverviewPageActions';

type Props = {
  readonly session: Session;
};

export const OverviewHeaderActions = ({ session }: Props) => (
  <>
    {session.archivedAt != null ? <ArchivedRestore session={session} /> : null}
    <OverviewPageActions session={session} />
  </>
);
