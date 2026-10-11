import { useRef, type KeyboardEvent } from 'react';
import { SelectableRow, Tooltip } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { ViewedRing } from '../../../../shared/components/ViewedRing';
import type { BranchTabEntry } from '../../branchTabs';
import { RailCount } from './RailCount';

type BranchViewed = {
  readonly viewed: number;
  readonly total: number;
};

type Props = {
  readonly tabs: ReadonlyArray<BranchTabEntry>;
  readonly current: BranchTab;
  readonly counts: Readonly<Partial<Record<BranchTab, number | null>>>;
  readonly viewed: BranchViewed | null;
  readonly hasFailingChecks: boolean;
  readonly hostRef: (node: HTMLDivElement | null) => void;
  readonly onSelect: (tab: BranchTab) => void;
};

const SECTION_ICON: Readonly<Record<BranchTab, LucideIcon>> = {
  pr: CONCEPT_ICONS.pr,
  comments: CONCEPT_ICONS.comments,
  files: CONCEPT_ICONS.diff,
  commits: CONCEPT_ICONS.commits,
  checks: CONCEPT_ICONS.checks,
};

export const BranchRail = ({
  tabs,
  current,
  counts,
  viewed,
  hasFailingChecks,
  hostRef,
  onSelect,
}: Props) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
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
    <nav aria-label="Sections" className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        ref={listRef}
        role="presentation"
        onKeyDown={onKeyDown}
        className="flex shrink-0 flex-col gap-0.5 px-2"
      >
        {tabs.map((entry) => {
          const Icon = SECTION_ICON[entry.id];
          const isCurrent = entry.id === current;
          const count = counts[entry.id];
          const isViewedShown = entry.id === 'files' && viewed !== null && viewed.total > 0;
          const row = (
            <SelectableRow
              selected={isCurrent}
              ariaCurrent={isCurrent ? 'page' : undefined}
              onClick={() => onSelect(entry.id)}
              className="min-h-8 items-center gap-2 px-2 text-label"
            >
              <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              {isViewedShown ? (
                <span className="flex shrink-0 items-center gap-1 text-chip tabular-nums text-faint-foreground">
                  <ViewedRing viewed={viewed.viewed} total={viewed.total} />
                  {viewed.viewed}/{viewed.total}
                </span>
              ) : null}
              {entry.id === 'checks' && hasFailingChecks ? (
                <span
                  role="img"
                  aria-label="Failing checks"
                  className="size-1.5 shrink-0 rounded-full bg-danger"
                />
              ) : null}
              {!isViewedShown && count !== undefined ? (
                <span className="shrink-0 text-chip">
                  <RailCount count={count} />
                </span>
              ) : null}
            </SelectableRow>
          );
          return entry.shortcut === null ? (
            <div key={entry.id}>{row}</div>
          ) : (
            <Tooltip
              key={entry.id}
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
          );
        })}
      </div>
      <div
        ref={hostRef}
        data-slot="branch-rail-files"
        className="flex min-h-0 flex-1 flex-col empty:hidden"
      />
    </nav>
  );
};
