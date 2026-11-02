import { PageHeader } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { SessionFilterPopover } from '../SessionActivityBar/SessionFilterPopover';
import { HiddenByFilters } from './HiddenByFilters';
import { NeedsYouElsewhere } from './NeedsYouElsewhere';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly filterSessions: ReadonlyArray<Session>;
  readonly archivedCount: number;
  readonly onArchivedShownChange: (isShown: boolean) => void;
  readonly hiddenCount: number;
  readonly needsYouElsewhere: number;
  readonly onClearFilters: () => void;
};

export const SessionsHeader = ({
  workspaceId,
  filterSessions,
  archivedCount,
  onArchivedShownChange,
  hiddenCount,
  needsYouElsewhere,
  onClearFilters,
}: Props) => (
  <PageHeader
    page="board"
    isOnColumn
    rhythm="section"
    title="Sessions"
    actions={
      <>
        <NeedsYouElsewhere count={needsYouElsewhere} onClear={onClearFilters} />
        <HiddenByFilters count={hiddenCount} onClear={onClearFilters} />
        <span className="relative inline-flex">
          <SessionFilterPopover
            workspaceId={workspaceId}
            sessions={filterSessions}
            archivedCount={archivedCount}
            onArchivedShownChange={onArchivedShownChange}
            isBoard
            canGroup={false}
          />
        </span>
      </>
    }
  />
);
