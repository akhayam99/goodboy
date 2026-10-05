import { useState, type RefObject } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { TreeGroup } from '../../lib/changeTree';
import { FilterChip } from './FilterChip';
import { GroupMenu } from './GroupMenu';

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
  const [isTyping, setIsTyping] = useState(false);
  useEscapeLayer(() => {
    if (query !== '') {
      onQuery('');
      return;
    }
    filterRef.current?.blur();
  }, isTyping);
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
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
          placeholder="Filter files..."
          aria-label="Filter files"
          data-diff-filter=""
          className="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-faint-foreground"
        />
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <FilterChip label="Unviewed" isOn={unviewedOnly} onChange={onUnviewedOnly} />
        <FilterChip label="With notes" isOn={notesOnly} onChange={onNotesOnly} />
        <span className="ml-auto shrink-0">
          <GroupMenu group={group} onGroup={onGroup} />
        </span>
      </div>
      {isFiltering ? (
        <p className="flex items-center gap-2 text-meta tabular-nums text-muted-foreground">
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
