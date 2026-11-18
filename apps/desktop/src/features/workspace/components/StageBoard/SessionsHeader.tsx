import type { ReactNode } from 'react';
import { PageHeader, RevealRegion } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { SessionFilterPopover } from './SessionFilterPopover';
import { HiddenByFilters } from './HiddenByFilters';
import { NeedsYouElsewhere } from './NeedsYouElsewhere';

type Props = {
  readonly isShown: boolean;
  readonly workspaceId: WorkspaceId;
  readonly filterSessions: ReadonlyArray<Session>;
  readonly hiddenCount: number;
  readonly needsYouElsewhere: number;
  readonly onClearFilters: () => void;
  readonly children: ReactNode;
};

export const SessionsHeader = ({
  isShown,
  workspaceId,
  filterSessions,
  hiddenCount,
  needsYouElsewhere,
  onClearFilters,
  children,
}: Props) => (
  <RevealRegion
    hasLanes
    header={
      isShown ? (
        <PageHeader
          page="board"
          isOnColumn
          rhythm="section"
          title={NAMES.board}
          actions={
            <>
              <NeedsYouElsewhere count={needsYouElsewhere} onClear={onClearFilters} />
              <HiddenByFilters count={hiddenCount} onClear={onClearFilters} />
              <span className="relative inline-flex">
                <SessionFilterPopover workspaceId={workspaceId} sessions={filterSessions} />
              </span>
            </>
          }
        />
      ) : null
    }
  >
    {children}
  </RevealRegion>
);
