import { Button, Eyebrow, type ListboxOption } from '@goodboy/ui';
import { FilterButton } from '../../../../../shared/components/FilterButton';
import { NAMES } from '../../../../../shared/utils/names';
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
    <FilterButton
      label={FILTER_LABEL}
      popoverLabel={FILTER_LABEL}
      activeCount={display.activeFilterCount}
      popoverHeight={440}
      facets={
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
              <div role="group" aria-label={NAMES.projects} className="flex flex-col">
                <span aria-hidden className={SUBHEAD}>
                  {NAMES.projects}
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
      }
    />
  );
};
