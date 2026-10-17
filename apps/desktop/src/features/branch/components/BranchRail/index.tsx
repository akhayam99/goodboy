import { useRef, type KeyboardEvent } from 'react';
import { SelectableRow, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchTabEntry } from '../../branchTabs';
import type { WorktreeEntryFacts } from '../../worktreeEntryFacts';
import { WORKTREE_ENTRY_ICONS } from '../../worktreeEntryIcons';
import { entryAriaLabel } from '../../entryAriaLabel';
import { WorktreeEntrySlot } from '../WorktreeEntrySlot';

type Props = {
  readonly tabs: ReadonlyArray<BranchTabEntry>;
  readonly current: BranchTab;
  readonly facts: WorktreeEntryFacts;
  readonly onSelect: (tab: BranchTab) => void;
};

const ENTRY_ID_PREFIX = 'worktree-entry-';

export const BranchRail = ({ tabs, current, facts, onSelect }: Props) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const rows = [
      ...(listRef.current?.querySelectorAll<HTMLElement>(`[id^="${ENTRY_ID_PREFIX}"]`) ?? []),
    ];
    const from = rows.findIndex((row) => row === event.target);
    if (from === -1) {
      return;
    }
    event.preventDefault();
    const to = Math.max(0, Math.min(rows.length - 1, from + (event.key === 'ArrowDown' ? 1 : -1)));
    const next = tabs[to];
    if (next === undefined || to === from) {
      return;
    }
    onSelect(next.id);
    rows[to]?.focus();
  };

  return (
    <nav aria-label="Worktree" className="flex min-h-0 flex-col px-2">
      <div ref={listRef} role="presentation" onKeyDown={onKeyDown} className="flex flex-col">
        {tabs.map((entry) => {
          const Icon = WORKTREE_ENTRY_ICONS[entry.id];
          const isCurrent = entry.id === current;
          const fact = facts[entry.id];
          const row = (
            <SelectableRow
              selected={isCurrent}
              ariaCurrent={isCurrent ? 'page' : undefined}
              ariaLabel={entryAriaLabel({ label: entry.label, fact })}
              id={`${ENTRY_ID_PREFIX}${entry.id}`}
              onClick={() => onSelect(entry.id)}
              className="h-7 items-center gap-2 px-2 text-ui"
            >
              <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span data-entry-label="" className="min-w-0 flex-1 truncate">
                {entry.label}
              </span>
              <WorktreeEntrySlot fact={fact} />
            </SelectableRow>
          );
          const hasTip = entry.shortcut !== null || fact.tooltip !== null;
          return (
            <div key={entry.id} className="flex flex-col">
              {!hasTip ? (
                row
              ) : (
                <Tooltip
                  side="right"
                  content={
                    <span className="inline-flex items-center gap-2">
                      {fact.tooltip === null ? entry.label : `${entry.label}, ${fact.tooltip}`}
                      {entry.shortcut === null ? null : (
                        <kbd className="font-sans text-faint-foreground">
                          {shortcutGlyphs(entry.shortcut)}
                        </kbd>
                      )}
                    </span>
                  }
                >
                  {row}
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
