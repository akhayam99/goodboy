import { useState, type RefObject } from 'react';
import { SearchField, useEscapeLayer, FOCUS_RING, cn } from '@goodboy/ui';
import type { TreeGroup } from '../../lib/changeTree';
import { FilterMenu, type Show } from './FilterMenu';

type Props = {
  readonly total: number;
  readonly unviewed: number;
  readonly commented: number;
  readonly query: string;
  readonly onQuery: (query: string) => void;
  readonly filterRef: RefObject<HTMLInputElement | null>;
  readonly unviewedOnly: boolean;
  readonly onUnviewedOnly: (next: boolean) => void;
  readonly commentedOnly: boolean;
  readonly onCommentedOnly: (next: boolean) => void;
  readonly group: TreeGroup;
  readonly onGroup: (group: TreeGroup) => void;
  readonly shown: number;
  readonly isFiltering: boolean;
  readonly onClear: () => void;
};

export const TreeHead = ({
  total,
  unviewed,
  commented,
  query,
  onQuery,
  filterRef,
  unviewedOnly,
  onUnviewedOnly,
  commentedOnly,
  onCommentedOnly,
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
  const showNow = (): Show => {
    if (unviewedOnly) {
      return 'unviewed';
    }
    return commentedOnly ? 'commented' : 'all';
  };
  const choose = (next: Show): void => {
    onUnviewedOnly(next === 'unviewed');
    onCommentedOnly(next === 'commented');
  };
  return (
    <div className="flex flex-col gap-2 px-2 pb-2">
      <div className="flex items-center gap-1">
        <SearchField
          inputRef={filterRef}
          value={query}
          onChange={onQuery}
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
          placeholder="Filter files"
          ariaLabel="Filter files"
          clearLabel="Clear filter"
          data-diff-filter=""
          className="min-w-0 flex-1"
        />
        <FilterMenu
          show={showNow()}
          onShow={choose}
          unviewed={unviewed}
          commented={commented}
          group={group}
          onGroup={onGroup}
        />
      </div>
      {isFiltering ? (
        <p className="flex items-center gap-2 text-meta tabular-nums text-muted-foreground">
          <span>
            Showing {shown} of {total}
          </span>
          <button
            type="button"
            onClick={onClear}
            className={cn('rounded-sm text-primary hover:underline', FOCUS_RING)}
          >
            Clear
          </button>
        </p>
      ) : null}
    </div>
  );
};
