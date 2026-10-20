import type { Session } from '@goodboy/types';
import { ArchivedRestore } from './ArchivedRestore';
import { OverviewActions } from './OverviewActions';
import { ViewToggle } from './ViewToggle';

type Props = {
  readonly session: Session;
  readonly hasNextLead?: boolean;
};

export const OverviewHeaderActions = ({ session, hasNextLead = false }: Props) => {
  const isArchived = session.archivedAt != null;
  return (
    <div className="flex items-center gap-2">
      <ViewToggle />
      {isArchived ? (
        <ArchivedRestore session={session} />
      ) : (
        <OverviewActions session={session} hasNextLead={hasNextLead} />
      )}
    </div>
  );
};
