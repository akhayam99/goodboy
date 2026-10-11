import { ISSUE_SEARCH_PLACEHOLDER } from '../../../integrations/issueCode/lookupCopy';
import type { ReactNode, RefObject } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Chip, IconButton, KbdPill, SearchField } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { FilterButton } from '../../../../shared/components/FilterButton';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

type Props = {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly searchRef: RefObject<HTMLInputElement | null>;
  readonly sessionLabel: string | null;
  readonly onClearSession: () => void;
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly activeFilterCount: number;
  readonly facets: ReactNode;
  readonly isRailCollapsed: boolean;
  readonly onDock?: (() => void) | undefined;
  readonly isSearchOnly?: boolean;
};

export const InboxListHeader = ({
  query,
  onQueryChange,
  searchRef,
  sessionLabel,
  onClearSession,
  isRefreshing,
  onRefresh,
  activeFilterCount,
  facets,
  isRailCollapsed,
  onDock,
  isSearchOnly = false,
}: Props) => {
  const search = (
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
  );

  if (isSearchOnly) {
    return search;
  }

  return (
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
      {isRailCollapsed ? <div className="flex w-[200px] min-w-0">{search}</div> : null}
      {isRailCollapsed ? (
        <FilterButton
          popoverLabel="Task filters"
          activeCount={activeFilterCount}
          facets={facets}
          onDock={onDock}
        />
      ) : null}
      <IconButton
        icon={RefreshCw}
        label="Refresh inbox"
        onClick={onRefresh}
        disabled={isRefreshing}
        busy={isRefreshing}
      />
    </div>
  );
};
