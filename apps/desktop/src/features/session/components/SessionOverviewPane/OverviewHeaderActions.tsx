import type { Session } from '@goodboy/types';
import { ArchivedGate } from './ArchivedGate';
import { ArchivedRestore } from './ArchivedRestore';
import { ContextChip } from './ContextChip';
import { OverviewActions } from './OverviewActions';
import { OverviewPageActions } from './OverviewPageActions';

type Props = {
  readonly session: Session;
  readonly hasNextLead?: boolean;
};

export const OverviewHeaderActions = ({ session, hasNextLead = false }: Props) => {
  const isArchived = session.archivedAt != null;
  return (
    <>
      {isArchived ? <ArchivedRestore session={session} /> : null}
      <ContextChip sessionId={session.id} />
      <OverviewPageActions session={session} />
      <ArchivedGate isArchived={isArchived}>
        <OverviewActions session={session} hasNextLead={hasNextLead} />
      </ArchivedGate>
    </>
  );
};
