import { ListFilter } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  Button,
  Eyebrow,
  IconButton,
  StatusDot,
  useDropdown,
  type ListboxOption,
} from '@goodboy/ui';
import type { Session, SessionSortKey, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSelectedProjectIds, useSessionViewPrefs } from '../../../../../store';
import { useProjectFilterOptions } from '../../../hooks/useProjectFilterOptions';
import { MarkAllReadButton } from './MarkAllReadButton';
import { DEFAULT_PREFS } from '../../../../../store/slices/session-view/types';
import { DisplayValueRow } from './DisplayValueRow';
import { FilterCheckRow } from './FilterCheckRow';
import { displayStateOf } from './displayStateOf';

const SORT_OPTIONS: ReadonlyArray<ListboxOption<SessionSortKey>> = [
  { value: 'needsYou', label: 'Needs you first' },
  { value: 'goal', label: 'Alphabetical' },
  { value: 'updatedAt', label: 'Last activity' },
  { value: 'createdAt', label: 'Created' },
];

const MENU_WIDTH = 240;
const MIN_PROJECTS_FOR_FACET = 2;
const FILTER_LABEL = 'Filter sessions';
const SUBHEAD = 'px-2 text-meta text-faint-foreground';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

type ToggleParams = {
  readonly projectId: string;
};

export const SessionFilterPopover = ({ workspaceId, sessions }: Props) => {
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionViewPrefs = useAppStore((state) => state.setSessionViewPrefs);
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const projectOptions = useProjectFilterOptions({ workspaceId, sessions });

  const dropdown = useDropdown({
    width: 'w-60',
    expectedWidth: MENU_WIDTH,
    expectedHeight: 440,
  });
  const { open: isOpen, toggle } = dropdown;

  const isProjectFacet = projectOptions.length >= MIN_PROJECTS_FOR_FACET;
  const display = displayStateOf({ prefs, selectedProjectIds });

  const toggleProject = ({ projectId }: ToggleParams) => {
    const next = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter((id) => id !== projectId)
      : [...selectedProjectIds, projectId];
    setSelectedProjectIds({ workspaceId, selectedProjectIds: next });
  };

  const reset = () => {
    setSessionViewPrefs({ workspaceId, patch: { sort: DEFAULT_PREFS.sort } });
    setSelectedProjectIds({ workspaceId, selectedProjectIds: [] });
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
        </div>
        {isProjectFacet ? (
          <div role="group" aria-label="Filter" className="flex flex-col gap-2 px-1">
            <Eyebrow label="Filter" muted className="px-2" />
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
                  onChange={() => toggleProject({ projectId: option.id })}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex px-1">
          <MarkAllReadButton workspaceId={workspaceId} sessions={sessions} />
        </div>
        {display.isDefault ? null : (
          <div className="flex px-1">
            <Button size="sm" variant="ghost" intent="neutral" onClick={reset}>
              Reset
            </Button>
          </div>
        )}
      </div>
    </AnchoredPopover>
  );
};
