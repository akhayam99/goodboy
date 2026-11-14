import { useMemo, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useAppStore, useMountDiffStats } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import type { BranchEntry } from '../../central/branches/branchStoryOf';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { NO_BRANCH_ROW_ID } from '../../central/board/branchBoardOf';
import { visibleGroupsOf, type BoardFilter } from '../../central/board/visibleGroupsOf';
import { BoardContext, type BoardContextValue } from './BoardContext';
import { BoardFilterNote } from './BoardFilterNote';
import { BoardLooseCards } from './BoardLooseCards';
import { LOOSE_ROW_ID } from './looseRowId';
import { BoardGroup } from './BoardGroup';
import { BoardTiles } from './BoardTiles';
import { useBranchBoard } from './useBranchBoard';
import { useOpenRows } from './useOpenRows';
import { useRemoveWorktrees } from './useRemoveWorktrees';

type Props = {
  readonly session: Session;
  readonly entries: ReadonlyArray<BranchEntry>;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
};

const WIDE_COLUMNS = '28px minmax(160px,1.4fr) 48px 200px 112px minmax(200px,3fr) 84px 72px';

const NARROW_COLUMNS = '24px minmax(120px,1.5fr) 40px 104px 104px minmax(120px,1.8fr)';

const WIDE_MIN_PX = 1040;

const NO_CARDS: ReadonlyArray<ActionCardModel> = [];

const SESSION_LEVEL_KINDS: ReadonlyArray<string> = ['archive-session', 'close-worktree'];

const MERGE_KIND = 'merge-series';

export const BranchBoard = ({ session, entries, cards: allCards, actionsFor, openFor }: Props) => {
  const cards = session.archivedAt == null ? allCards : NO_CARDS;
  const sessionId = session.id;
  const { board, kpis, entryByRowId, mergedAtByMountId, runningByRowId, newRowIds, now } =
    useBranchBoard({ session, entries });
  const [filter, setFilter] = useState<BoardFilter | null>(null);
  const [isMergedExpanded, setIsMergedExpanded] = useState(false);
  const aloneRowId = board.isAlone ? (board.rows[0]?.id ?? null) : null;
  const { openIds, toggle } = useOpenRows({ aloneRowId });
  const isToolPushing = useAppStore((state) => selectOpenDrawer(state)?.kind === 'terminal');
  const { ref: widthRef, width } = useElementWidth();
  const isNarrow = isToolPushing || (width !== null && width < WIDE_MIN_PX);
  const diffStatByPath = useMountDiffStats(sessionId);
  const mergedMountIds = useMemo(
    () =>
      new Set<string>(
        board.rows.flatMap((row) => (row.isMerged && row.mountId !== null ? [row.mountId] : [])),
      ),
    [board.rows],
  );
  const removal = useRemoveWorktrees({ sessionId, mergedMountIds });
  const rowById = useMemo(() => new Map(board.rows.map((row) => [row.id, row])), [board.rows]);
  const cardsByRowId = useMemo(() => {
    const byRow = new Map<string, ReadonlyArray<ActionCardModel>>();
    for (const card of cards) {
      const rowId = card.mountId ?? NO_BRANCH_ROW_ID;
      if (SESSION_LEVEL_KINDS.includes(card.kind) || card.kind === MERGE_KIND) {
        continue;
      }
      const key = rowById.has(rowId) ? rowId : LOOSE_ROW_ID;
      byRow.set(key, [...(byRow.get(key) ?? []), card]);
    }
    return byRow;
  }, [cards, rowById]);
  const mergeCard = useMemo(() => cards.find((card) => card.kind === MERGE_KIND) ?? null, [cards]);
  const groups = visibleGroupsOf({ board, filter, isMergedExpanded });
  const firstOpenGroup = groups.find((group) => group.id !== 'merged')?.id ?? null;
  const value: BoardContextValue = {
    session,
    now,
    isNarrow,
    rowById,
    entryByRowId,
    runningByRowId,
    mergedAtByMountId,
    newRowIds,
    diffStatByPath,
    cardsByRowId,
    mergeCard,
    actionsFor,
    openFor,
    removal,
    openIds,
    onToggleRow: toggle,
  };
  return (
    <div ref={widthRef} data-slot="branch-board-section" className="flex min-w-0 flex-col gap-4">
      <BoardTiles kpis={kpis} filter={filter} onFilter={({ filter: next }) => setFilter(next)} />
      {filter === null ? null : <BoardFilterNote filter={filter} onClear={() => setFilter(null)} />}
      <BoardContext.Provider value={value}>
        <BoardLooseCards />
        <div
          role="region"
          aria-label="Branches"
          data-slot="branch-board"
          data-narrow={isNarrow}
          style={{ gridTemplateColumns: isNarrow ? NARROW_COLUMNS : WIDE_COLUMNS }}
          className={cn(
            'group/board grid min-w-0 gap-y-4 rounded-lg bg-subtle p-3',
            isNarrow ? 'gap-x-3' : 'gap-x-4',
          )}
        >
          {groups.map((group) => (
            <BoardGroup
              key={group.id}
              group={group}
              isFirstOpenGroup={group.id === firstOpenGroup}
              onShowMore={() => setIsMergedExpanded((isExpanded) => !isExpanded)}
            />
          ))}
        </div>
      </BoardContext.Provider>
    </div>
  );
};
