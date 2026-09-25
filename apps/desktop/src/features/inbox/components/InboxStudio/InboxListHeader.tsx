import type { ReactNode, RefObject } from 'react';
import { ListFilter, RefreshCw, Search, X } from 'lucide-react';
import { AnchoredPopover, Chip, IconButton, KbdPill, cn, useDropdown } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly searchRef: RefObject<HTMLInputElement | null>;
  readonly sessionLabel: string | null;
  readonly onClearSession: () => void;
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly isFacetFolded: boolean;
  readonly activeFilterCount: number;
  readonly facets: ReactNode;
};

export const InboxListHeader = ({
  query,
  onQueryChange,
  searchRef,
  sessionLabel,
  onClearSession,
  isRefreshing,
  onRefresh,
  isFacetFolded,
  activeFilterCount,
  facets,
}: Props) => {
  const filters = useDropdown({ align: 'end', width: 'w-64', expectedHeight: 420 });

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
      <div className="flex h-7 w-[200px] min-w-0 items-center gap-1.5 rounded-md border border-border-soft bg-background px-2 focus-within:border-primary">
        <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || query === '') {
              return;
            }
            event.preventDefault();
            onQueryChange('');
          }}
          placeholder="Search"
          aria-label="Search the inbox"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-faint-foreground"
        />
        <KbdPill>/</KbdPill>
      </div>
      {isFacetFolded ? (
        <AnchoredPopover
          dropdown={filters}
          role="dialog"
          ariaLabel="Inbox filters"
          className="max-h-[70vh] py-1"
          trigger={
            <button
              type="button"
              onClick={filters.toggle}
              aria-expanded={filters.open}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md border border-border-soft px-2 text-xs text-muted-foreground hover:bg-hover hover:text-foreground',
                filters.open && 'bg-selected text-foreground',
              )}
            >
              <ListFilter size={ICON_SIZE.row} aria-hidden />
              Filters
              {activeFilterCount > 0 ? <KbdPill>{activeFilterCount}</KbdPill> : null}
            </button>
          }
        >
          {facets}
        </AnchoredPopover>
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
