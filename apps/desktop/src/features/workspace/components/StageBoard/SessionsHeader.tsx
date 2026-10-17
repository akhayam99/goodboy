import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { Session, SessionPageView, WorkspaceId } from '@goodboy/types';
import { SessionFilterPopover } from '../SessionActivityBar/SessionFilterPopover';
import { HiddenByFilters } from './HiddenByFilters';

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
  hiddenCount,
  onClearFilters,
}: Props) => (
  <div data-slot="board-header" className="flex shrink-0 flex-col">
    <div
      data-slot="pane-title-row"
      className="flex h-8 shrink-0 items-center justify-between gap-4"
    >
      <h1 className="min-w-0 truncate text-title text-foreground">Sessions</h1>
      <span className="flex shrink-0 items-center gap-2">
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
          />
        </span>
      </span>
    </div>
  </div>
);
