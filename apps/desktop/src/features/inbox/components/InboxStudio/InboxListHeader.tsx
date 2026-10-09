import { ISSUE_SEARCH_PLACEHOLDER } from '../../../integrations/issueCode/lookupCopy';
import type { ReactNode, RefObject } from 'react';
import { ListFilter, RefreshCw, X } from 'lucide-react';
import {
  AnchoredPopover,
  Chip,
  IconButton,
  KbdPill,
  SearchField,
  cn,
  useDropdown,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
}: Props) => {
  const filters = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 420 });

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
        className="w-[200px] min-w-0"
      />
      <AnchoredPopover
        dropdown={filters}
        role="dialog"
        ariaLabel="Task filters"
        className="max-h-[70vh] py-1"
        trigger={
          <button
            type="button"
            onClick={filters.toggle}
            aria-expanded={filters.open}
            className={cn(
              'flex h-7 items-center gap-2 rounded-md border border-border-soft px-2 text-label text-muted-foreground hover:bg-hover hover:text-foreground',
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
