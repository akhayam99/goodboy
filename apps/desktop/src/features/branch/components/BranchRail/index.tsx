import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SelectableRow, StatusDot, Tooltip } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { BranchTabEntry } from '../../branchTabs';
import type { WorktreeEntryFacts } from '../../worktreeEntryFacts';

type Props = {
  readonly tabs: ReadonlyArray<BranchTabEntry>;
  readonly current: BranchTab;
  readonly facts: WorktreeEntryFacts;
  readonly onSelect: (tab: BranchTab) => void;
};

const ENTRY_ID_PREFIX = 'worktree-entry-';

const SECTION_ICON: Readonly<Record<BranchTab, LucideIcon>> = {
  pr: CONCEPT_ICONS.pr,
  comments: CONCEPT_ICONS.comments,
  files: CONCEPT_ICONS.diff,
  commits: CONCEPT_ICONS.commits,
  checks: CONCEPT_ICONS.checks,
};

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
          const Icon = SECTION_ICON[entry.id];
          const isCurrent = entry.id === current;
          const fact = facts[entry.id];
          const row = (
            <SelectableRow
              selected={isCurrent}
              ariaCurrent={isCurrent ? 'page' : undefined}
              ariaLabel={
                fact.text === null || fact.text === ''
                  ? entry.label
                  : `${entry.label}, ${fact.text}`
              }
              id={`${ENTRY_ID_PREFIX}${entry.id}`}
              onClick={() => onSelect(entry.id)}
              className="h-7 items-center gap-2 px-2 text-label"
            >
              <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span data-entry-label="" className="min-w-0 flex-1 truncate">
                {entry.label}
              </span>
              <span className="flex w-20 shrink-0 items-center justify-end gap-1 text-meta tabular-nums text-faint-foreground">
                {fact.tone === null ? null : <StatusDot tone={fact.tone} size="sm" />}
                {fact.text === null ? (
                  <span role="img" aria-label="Not loaded">
                    -
                  </span>
                ) : (
                  <span className="truncate">{fact.text}</span>
                )}
              </span>
            </SelectableRow>
          );
          return (
            <div key={entry.id} className="flex flex-col">
              {entry.shortcut === null ? (
                row
              ) : (
                <Tooltip
                  side="right"
                  content={
                    <span className="inline-flex items-center gap-2">
                      {entry.label}
                      <kbd className="font-sans text-faint-foreground">
                        {shortcutGlyphs(entry.shortcut)}
                      </kbd>
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
