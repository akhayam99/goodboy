import { useEffect } from 'react';
import { ListFilter } from 'lucide-react';
import { AnchoredPopover, IconButton, StatusDot, useDropdown } from '@goodboy/ui';
import type {
  Session,
  SessionGroupKey,
  SessionSortKey,
  SessionStage,
  WorkspaceId,
} from '@goodboy/types';
import {
  useAppStore,
  useSelectedProjectIds,
  useSessionStages,
  useSessionViewPrefs,
} from '../../../../../store';
import { useProjectFilterOptions } from '../../../hooks/useProjectFilterOptions';
import { useSidebarPeekHold } from '../../SidebarPeekOverlay/hold';
import { useClearSessionFilters } from '../useClearSessionFilters';
import { FilterChoice } from './FilterChoice';
import { FilterCount } from './FilterCount';
import { FilterSection } from './FilterSection';

type SortOption = {
  readonly key: SessionSortKey;
  readonly label: string;
};

type GroupOption = {
  readonly key: SessionGroupKey;
  readonly label: string;
};

type StatusOption = {
  readonly stage: SessionStage;
  readonly label: string;
};

const STATUS_OPTIONS: ReadonlyArray<StatusOption> = [
  { stage: 'attention', label: 'Needs you' },
  { stage: 'running', label: 'Running' },
  { stage: 'review', label: 'In review' },
  { stage: 'building', label: 'Building' },
  { stage: 'done', label: 'Done' },
];

const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  { key: 'needsYou', label: 'Needs you first' },
  { key: 'goal', label: 'Alphabetical' },
  { key: 'updatedAt', label: 'Last activity' },
  { key: 'createdAt', label: 'Created' },
];

const GROUP_OPTIONS: ReadonlyArray<GroupOption> = [
  { key: 'none', label: 'None' },
  { key: 'pr', label: 'PR state' },
  { key: 'stage', label: 'Stage' },
  { key: 'project', label: 'Project' },
];

const MENU_WIDTH = 240;
const MIN_PROJECTS_FOR_FACET = 2;
const FILTER_LABEL = 'Filter sessions';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly archivedCount: number;
  readonly onArchivedShownChange: (isShown: boolean) => void;
  readonly isBoard?: boolean;
};

export const SessionFilterPopover = ({
  workspaceId,
  sessions,
  archivedCount,
  onArchivedShownChange,
  isBoard = false,
}: Props) => {
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionViewPrefs = useAppStore((state) => state.setSessionViewPrefs);
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const projectOptions = useProjectFilterOptions({ workspaceId, sessions });
  const stageBySession = useSessionStages(sessions);
  const clearFilters = useClearSessionFilters({ workspaceId });

  const { hold, release } = useSidebarPeekHold();
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-60',
    expectedWidth: MENU_WIDTH,
    expectedHeight: 440,
  });
  const { open: isOpen, toggle } = dropdown;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    hold();
    return () => release();
  }, [hold, isOpen, release]);

  const stageCounts = new Map<SessionStage, number>();
  for (const session of sessions) {
    const stage = stageBySession[session.id];
    if (stage !== undefined) {
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
    }
  }

  const activeCount = (isBoard ? 0 : prefs.statusFilter.length) + selectedProjectIds.length;

  const toggleStatus = (stage: SessionStage) => {
    const next = prefs.statusFilter.includes(stage)
      ? prefs.statusFilter.filter((entry) => entry !== stage)
      : [...prefs.statusFilter, stage];
    setSessionViewPrefs({ workspaceId, patch: { statusFilter: next } });
  };

  const toggleProject = (projectId: string) => {
    const next = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter((id) => id !== projectId)
      : [...selectedProjectIds, projectId];
    setSelectedProjectIds({ workspaceId, selectedProjectIds: next });
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={FILTER_LABEL}
      className="py-1"
      hasBackdrop
      trigger={
        <>
          <IconButton
            icon={ListFilter}
            label={FILTER_LABEL}
            size="xs"
            aria-expanded={isOpen}
            isTooltipSuppressed={isOpen}
            onClick={toggle}
            className={isOpen ? 'bg-selected text-foreground' : undefined}
          />
          {activeCount > 0 ? (
            <span
              data-filter-dot="active"
              className="pointer-events-none absolute right-0.5 top-0.5 flex"
            >
              <StatusDot tone="neutral" size="sm" />
            </span>
          ) : null}
        </>
      }
    >
      {isBoard ? null : (
        <FilterSection title="Status">
          {STATUS_OPTIONS.map((option) => (
            <FilterChoice
              key={option.stage}
              kind="multiple"
              label={option.label}
              isChecked={prefs.statusFilter.includes(option.stage)}
              onSelect={() => toggleStatus(option.stage)}
              trailing={<FilterCount count={stageCounts.get(option.stage) ?? 0} />}
            />
          ))}
        </FilterSection>
      )}
      {projectOptions.length >= MIN_PROJECTS_FOR_FACET ? (
        <FilterSection title="Project">
          {projectOptions.map((option) => (
            <FilterChoice
              key={option.id}
              kind="multiple"
              label={option.label}
              isChecked={selectedProjectIds.includes(option.id)}
              onSelect={() => toggleProject(option.id)}
              trailing={<FilterCount count={option.count} />}
            />
          ))}
        </FilterSection>
      ) : null}
      {isBoard ? null : (
        <FilterSection title="Archive">
          <FilterChoice
            kind="multiple"
            label={`Show archived (${archivedCount})`}
            isChecked={prefs.isArchivedShown}
            onSelect={() => onArchivedShownChange(!prefs.isArchivedShown)}
          />
        </FilterSection>
      )}
      <FilterSection title="Sort">
        {SORT_OPTIONS.map((option) => (
          <FilterChoice
            key={option.key}
            kind="single"
            label={option.label}
            isChecked={prefs.sort === option.key}
            onSelect={() => setSessionViewPrefs({ workspaceId, patch: { sort: option.key } })}
          />
        ))}
      </FilterSection>
      {isBoard ? null : (
        <FilterSection title="Group">
          {GROUP_OPTIONS.map((option) => (
            <FilterChoice
              key={option.key}
              kind="single"
              label={option.label}
              isChecked={prefs.group === option.key}
              onSelect={() => setSessionViewPrefs({ workspaceId, patch: { group: option.key } })}
            />
          ))}
        </FilterSection>
      )}
      {activeCount > 0 ? (
        <div className="flex px-1 py-1">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-sm px-2 py-1 text-label text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:outline-none"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </AnchoredPopover>
  );
};
