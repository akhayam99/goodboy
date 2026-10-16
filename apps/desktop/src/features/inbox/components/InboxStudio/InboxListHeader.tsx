import { ISSUE_SEARCH_PLACEHOLDER } from '../../../integrations/issueCode/lookupCopy';
import type { ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { Chip, KbdPill, SearchField, SegmentedTabs } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { TaskListMenu } from '../../../actions/TaskListMenu';
import type { TaskGroupBy } from '../../taskGroups';
import type { TaskScope } from '../../taskListViewStorage';
import { TasksFilterMenu } from './TasksFilterMenu';
import { TasksGroupByMenu } from './TasksGroupByMenu';

type Props = {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly searchRef: RefObject<HTMLInputElement | null>;
  readonly sessionLabel: string | null;
  readonly onClearSession: () => void;
  readonly scope: TaskScope;
  readonly onScopeChange: (scope: TaskScope) => void;
  readonly groupBy: TaskGroupBy;
  readonly onGroupBy: (groupBy: TaskGroupBy) => void;
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly onManageTools: () => void;
  readonly activeFilterCount: number;
  readonly facets: ReactNode;
};

const SCOPE_OPTIONS = [
  { value: 'for-me', label: 'For me' },
  { value: 'all', label: 'All' },
] as const satisfies ReadonlyArray<{ readonly value: TaskScope; readonly label: string }>;

export const InboxListHeader = ({
  query,
  onQueryChange,
  searchRef,
  sessionLabel,
  onClearSession,
  scope,
  onScopeChange,
  groupBy,
  onGroupBy,
  isRefreshing,
  onRefresh,
  onManageTools,
  activeFilterCount,
  facets,
}: Props) => (
  <div className="flex min-w-0 items-center gap-2">
    {sessionLabel != null ? (
      <Chip
        as="button"
        size="sm"
        tone="primary"
        emphasis="strong"
        icon={<CONCEPT_ICONS.sessions size={ICON_SIZE.row} aria-hidden className="shrink-0" />}
        label={<span className="max-w-48 truncate">{`Session: ${sessionLabel}`}</span>}
        trailing={<X size={ICON_SIZE.row} aria-hidden className="shrink-0" />}
        ariaLabel={`Clear the session filter: ${sessionLabel}`}
        onClick={onClearSession}
      />
    ) : null}
    <SegmentedTabs
      size="xs"
      ariaLabel="Whose tasks"
      options={SCOPE_OPTIONS}
      value={scope}
      onChange={onScopeChange}
    />
    <div className="flex w-[220px] min-w-0">
      <SearchField
        inputRef={searchRef}
        value={query}
        onChange={onQueryChange}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') {
            return;
          }
          event.preventDefault();
          if (query === '') {
            event.currentTarget.blur();
            return;
          }
          onQueryChange('');
        }}
        placeholder={ISSUE_SEARCH_PLACEHOLDER}
        ariaLabel="Search tasks"
        autoComplete="off"
        hint={<KbdPill>{shortcutGlyphs('list.search')}</KbdPill>}
        className="min-w-0 flex-1"
      />
    </div>
    <TasksFilterMenu activeCount={activeFilterCount} facets={facets} />
    <TasksGroupByMenu groupBy={groupBy} onGroupBy={onGroupBy} />
    <TaskListMenu facts={{ isRefreshing, onRefresh, onManageTools }} />
  </div>
);
