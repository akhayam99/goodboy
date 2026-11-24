import type { ReactNode } from 'react';
import { PageHeader, RevealRegion } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { SessionFilterPopover } from './SessionFilterPopover';
import { HiddenByFilters } from './HiddenByFilters';

type Props = {
  readonly isShown: boolean;
  readonly workspaceId: WorkspaceId;
  readonly filterSessions: ReadonlyArray<Session>;
  readonly hiddenCount: number;
  readonly onClearFilters: () => void;
  readonly children: ReactNode;
};

export const SessionsHeader = ({
  isShown,
  workspaceId,
  filterSessions,
  hiddenCount,
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
          toolbar={
            <>
              <SessionFilterPopover workspaceId={workspaceId} sessions={filterSessions} />
              <HiddenByFilters count={hiddenCount} onClear={onClearFilters} />
            </>
          }
        />
      ) : null
    }
  >
    {children}
  </RevealRegion>
);
