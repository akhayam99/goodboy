import { useEffect } from 'react';
import { ListFilter } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  Eyebrow,
  IconButton,
  StatusDot,
  Switch,
  useDropdown,
  type ListboxOption,
} from '@goodboy/ui';
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
import { DEFAULT_PREFS } from '../../../../../store/slices/session-view/types';
import { DisplayValueRow } from './DisplayValueRow';
import { FilterCheckRow } from './FilterCheckRow';
import { displayStateOf } from './displayStateOf';

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

const SORT_OPTIONS: ReadonlyArray<ListboxOption<SessionSortKey>> = [
  { value: 'needsYou', label: 'Needs you first' },
  { value: 'goal', label: 'Alphabetical' },
  { value: 'updatedAt', label: 'Last activity' },
  { value: 'createdAt', label: 'Created' },
];

const GROUP_OPTIONS: ReadonlyArray<ListboxOption<SessionGroupKey>> = [
  { value: 'none', label: 'None' },
  { value: 'pr', label: 'PR state' },
  { value: 'stage', label: 'Stage' },
  { value: 'project', label: 'Project' },
];

const MENU_WIDTH = 240;
const MIN_PROJECTS_FOR_FACET = 2;
const FILTER_LABEL = 'Filter sessions';
const SUBHEAD = 'px-2 text-meta text-faint-foreground';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly archivedCount: number;
  readonly onArchivedShownChange: (isShown: boolean) => void;
  readonly isBoard?: boolean;
  readonly canGroup?: boolean;
};

export const SessionFilterPopover = ({
  workspaceId,
  sessions,
  archivedCount,
  onArchivedShownChange,
  isBoard = false,
  canGroup = true,
}: Props) => {
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionViewPrefs = useAppStore((state) => state.setSessionViewPrefs);
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const projectOptions = useProjectFilterOptions({ workspaceId, sessions });
  const stageBySession = useSessionStages(sessions);

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
  const statusRows = STATUS_OPTIONS.filter(
    (option) =>
      (stageCounts.get(option.stage) ?? 0) > 0 || prefs.statusFilter.includes(option.stage),
  );
  const isProjectFacet = projectOptions.length >= MIN_PROJECTS_FOR_FACET;
  const isGroupShown = !isBoard && canGroup;
  const display = displayStateOf({ prefs, selectedProjectIds, isBoard });

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

  const reset = () => {
    setSessionViewPrefs({
      workspaceId,
      patch: isBoard
        ? { sort: DEFAULT_PREFS.sort }
        : {
            sort: DEFAULT_PREFS.sort,
            group: DEFAULT_PREFS.group,
            statusFilter: DEFAULT_PREFS.statusFilter,
          },
    });
    setSelectedProjectIds({ workspaceId, selectedProjectIds: [] });
    if (!isBoard && prefs.isArchivedShown) {
      onArchivedShownChange(false);
    }
  };

  const isFilterShown = (!isBoard && statusRows.length > 0) || isProjectFacet;

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
          {display.activeFilterCount > 0 ? (
            <span
              data-filter-dot="active"
              className="pointer-events-none absolute right-0.5 top-0.5 flex"
            >
              <StatusDot tone="primary" size="sm" />
            </span>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Display" className="flex flex-col gap-0.5 px-1">
          <DisplayValueRow
            label="Sort"
            value={prefs.sort}
            options={SORT_OPTIONS}
            onChange={(sort) => setSessionViewPrefs({ workspaceId, patch: { sort } })}
          />
          {isGroupShown ? (
            <DisplayValueRow
              label="Group"
              value={prefs.group}
              options={GROUP_OPTIONS}
              onChange={(group) => setSessionViewPrefs({ workspaceId, patch: { group } })}
            />
          ) : null}
        </div>
        {isFilterShown || !isBoard ? (
          <div role="group" aria-label="Filter" className="flex flex-col gap-2 px-1">
            <Eyebrow label="Filter" muted className="px-2" />
            {!isBoard && statusRows.length > 0 ? (
              <div role="group" aria-label="Status" className="flex flex-col">
                <span aria-hidden className={SUBHEAD}>
                  Status
                </span>
                {statusRows.map((option) => (
                  <FilterCheckRow
                    key={option.stage}
                    label={option.label}
                    count={stageCounts.get(option.stage) ?? 0}
                    isChecked={prefs.statusFilter.includes(option.stage)}
                    onChange={() => toggleStatus(option.stage)}
                  />
                ))}
              </div>
            ) : null}
            {isProjectFacet ? (
              <div role="group" aria-label="Project" className="flex flex-col">
                <span aria-hidden className={SUBHEAD}>
                  Project
                </span>
                {projectOptions.map((option) => (
                  <FilterCheckRow
                    key={option.id}
                    label={option.label}
                    count={option.count}
                    isChecked={selectedProjectIds.includes(option.id)}
                    onChange={() => toggleProject(option.id)}
                  />
                ))}
              </div>
            ) : null}
            {isBoard ? null : (
              <Switch
                label={
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="min-w-0 flex-1 truncate">Show archived</span>
                    <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
                      {archivedCount}
                    </span>
                  </span>
                }
                ariaLabel={`Show archived, ${archivedCount}`}
                checked={prefs.isArchivedShown}
                onChange={onArchivedShownChange}
                className="w-full flex-row-reverse justify-between rounded-md px-2"
              />
            )}
          </div>
        ) : null}
        {display.isDefault ? null : (
          <div className="flex px-1">
            <Button size="sm" variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        )}
      </div>
    </AnchoredPopover>
  );
};
