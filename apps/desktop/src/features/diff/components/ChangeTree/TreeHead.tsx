import type { RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import { KbdPill, OverflowMenu, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TreeGroup } from '../../lib/changeTree';

type Props = {
  readonly viewed: number;
  readonly total: number;
  readonly query: string;
  readonly onQuery: (query: string) => void;
  readonly filterRef: RefObject<HTMLInputElement | null>;
  readonly unviewedOnly: boolean;
  readonly onUnviewedOnly: (next: boolean) => void;
  readonly notesOnly: boolean;
  readonly onNotesOnly: (next: boolean) => void;
  readonly group: TreeGroup;
  readonly onGroup: (group: TreeGroup) => void;
  readonly shown: number;
  readonly isFiltering: boolean;
  readonly onClear: () => void;
};

const GROUP_LABEL: Record<TreeGroup, string> = { folders: 'Folders', kind: 'Kind' };

const CHIP_CLASS =
  'inline-flex h-6 shrink-0 items-center rounded-sm border px-2 text-chip transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const TreeHead = ({
  viewed,
  total,
  query,
  onQuery,
  filterRef,
  unviewedOnly,
  onUnviewedOnly,
  notesOnly,
  onNotesOnly,
  group,
  onGroup,
  shown,
  isFiltering,
  onClear,
}: Props) => {
  const share = total === 0 ? 0 : viewed / total;
  return (
    <div className="flex flex-col gap-2 px-3 pb-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-meta tabular-nums text-muted-foreground">
          {viewed} of {total} viewed
        </p>
        <span className="text-meta tabular-nums text-faint-foreground">
          {Math.round(share * 100)}%
        </span>
      </div>
      <span
        aria-hidden
        className="relative block h-0.5 overflow-hidden rounded-full bg-border-soft"
      >
        <span
          className="absolute inset-y-0 left-0 block rounded-full bg-primary"
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </span>
      <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2 focus-within:ring-2 focus-within:ring-focus-ring">
        <input
          ref={filterRef}
          type="text"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') {
              return;
            }
            event.stopPropagation();
            if (query !== '') {
              onQuery('');
              return;
            }
            event.currentTarget.blur();
          }}
          placeholder="Filter files..."
          aria-label="Filter files"
          className="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-faint-foreground"
        />
        <KbdPill>T</KbdPill>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={unviewedOnly}
          onClick={() => onUnviewedOnly(!unviewedOnly)}
          className={cn(
            CHIP_CLASS,
            unviewedOnly
              ? 'border-transparent bg-selected text-foreground'
              : 'border-border text-muted-foreground hover:bg-hover hover:text-foreground',
          )}
        >
          Unviewed
        </button>
        <button
          type="button"
          aria-pressed={notesOnly}
          onClick={() => onNotesOnly(!notesOnly)}
          className={cn(
            CHIP_CLASS,
            notesOnly
              ? 'border-transparent bg-selected text-foreground'
              : 'border-border text-muted-foreground hover:bg-hover hover:text-foreground',
          )}
        >
          With notes
        </button>
        <span className="ml-auto">
          <OverflowMenu
            label="Group files"
            align="right"
            triggerClassName="flex items-center gap-1 text-meta"
            trigger={
              <>
                Group: {GROUP_LABEL[group]}
                <ChevronDown size={ICON_SIZE.row} aria-hidden />
              </>
            }
            items={(['folders', 'kind'] as const).map((value) => ({
              kind: 'item' as const,
              key: value,
              label: GROUP_LABEL[value],
              hint: value === group ? 'Current' : undefined,
              onClick: () => onGroup(value),
            }))}
          />
        </span>
      </div>
      {isFiltering ? (
        <p className="flex items-center gap-1.5 text-meta tabular-nums text-muted-foreground">
          <span>
            Showing {shown} of {total}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Clear
          </button>
        </p>
      ) : null}
    </div>
  );
};
