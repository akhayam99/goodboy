import type { Session } from '@goodboy/types';
import { ArchivedRestore } from './ArchivedRestore';
import { OverviewActions } from './OverviewActions';

type Props = {
  readonly session: Session;
  readonly hasNextLead?: boolean;
};

export const OverviewHeaderActions = ({ session, hasNextLead = false }: Props) => {
  if (session.archivedAt != null) {
    return <ArchivedRestore session={session} />;
  }
  return <OverviewActions session={session} hasNextLead={hasNextLead} />;
};
