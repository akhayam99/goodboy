import type { Session } from '@goodboy/types';
import { ArchivedRestore } from './ArchivedRestore';
import { ArchivePrimary } from './ArchivePrimary';
import { OverviewActions } from './OverviewActions';

type Props = {
  readonly session: Session;
};

export const OverviewHeaderActions = ({ session }: Props) => {
  const isArchived = session.archivedAt != null;
  return (
    <div className="flex items-center gap-2">
      {isArchived ? (
        <ArchivedRestore session={session} />
      ) : (
        <>
          <OverviewActions session={session} />
          <ArchivePrimary session={session} />
        </>
      )}
    </div>
  );
};
