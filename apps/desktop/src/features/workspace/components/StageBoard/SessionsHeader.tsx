import { PageHeader, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { Session, SessionPageView, WorkspaceId } from '@goodboy/types';
import type { ProjectGitStatusEntry } from '../../hooks/useProjectGitStatuses';
import { SessionFilterPopover } from '../SessionActivityBar/SessionFilterPopover';
import { repoNeedsAttention } from '../ProjectGitPill/repoNeedsAttention';
import { HiddenByFilters } from './HiddenByFilters';
import { RepoStatusSection } from '../ProjectGitPill/RepoStatusSection';

const VIEW_OPTIONS: ReadonlyArray<SegmentedTabOption<SessionPageView>> = [
  { value: 'board', label: 'Board' },
  { value: 'list', label: 'List' },
];

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly view: SessionPageView;
  readonly onViewChange: (view: SessionPageView) => void;
  readonly filterSessions: ReadonlyArray<Session>;
  readonly archivedCount: number;
  readonly onArchivedShownChange: (isShown: boolean) => void;
  readonly gitEntries: ReadonlyArray<ProjectGitStatusEntry>;
  readonly hiddenCount: number;
  readonly onClearFilters: () => void;
};

export const SessionsHeader = ({
  workspaceId,
  view,
  onViewChange,
  filterSessions,
  archivedCount,
  onArchivedShownChange,
  gitEntries,
  hiddenCount,
  onClearFilters,
}: Props) => (
  <PageHeader
    page="board"
    isOnColumn
    rhythm="section"
    title="Sessions"
    actions={
      <>
        <HiddenByFilters count={hiddenCount} onClear={onClearFilters} />
        <SegmentedTabs
          size="xs"
          ariaLabel="Sessions view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={onViewChange}
        />
        <span className="relative inline-flex">
          <SessionFilterPopover
            workspaceId={workspaceId}
            sessions={filterSessions}
            archivedCount={archivedCount}
            onArchivedShownChange={onArchivedShownChange}
            isBoard={view === 'board'}
            canGroup={false}
            hasAttention={gitEntries.some(({ status }) => repoNeedsAttention({ status }))}
            footer={<RepoStatusSection workspaceId={workspaceId} entries={gitEntries} />}
          />
        </span>
      </>
    }
  />
);
