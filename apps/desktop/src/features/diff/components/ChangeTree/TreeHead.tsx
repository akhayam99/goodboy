import { useState, type RefObject } from 'react';
import { Search } from 'lucide-react';
import { SegmentedTabs, useEscapeLayer } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { TreeGroup } from '../../lib/changeTree';
import { GroupMenu } from './GroupMenu';

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

type Show = 'all' | 'unviewed' | 'commented';

type BadgeParams = {
  readonly count: number;
};

const countBadge = ({ count }: BadgeParams) => (
  <span className="tabular-nums text-faint-foreground">{count}</span>
);

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
        <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 focus-within:ring-2 focus-within:ring-focus-ring">
          <Search size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
          <input
            ref={filterRef}
            type="text"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onFocus={() => setIsTyping(true)}
            onBlur={() => setIsTyping(false)}
            placeholder="Filter files"
            aria-label="Filter files"
            data-diff-filter=""
            className="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-faint-foreground"
          />
          <kbd className="shrink-0 font-sans text-chip text-faint-foreground">
            {shortcutGlyphs('diff.focusFilter')}
          </kbd>
        </div>
        <GroupMenu group={group} onGroup={onGroup} />
      </div>
      <SegmentedTabs<Show>
        ariaLabel="Show files"
        size="xs"
        fill
        value={showNow()}
        onChange={choose}
        options={[
          { value: 'all', label: 'All' },
          { value: 'unviewed', label: 'Unviewed', badge: countBadge({ count: unviewed }) },
          { value: 'commented', label: 'Commented', badge: countBadge({ count: commented }) },
        ]}
      />
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
