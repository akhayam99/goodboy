import { useMemo, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useMountDiffStats } from '../../../../store';
import type { BranchEntry } from '../../central/branches/branchStoryOf';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { cardRowIdOf } from '../../central/board/cardRowIdOf';
import { visibleGroupsOf } from '../../central/board/visibleGroupsOf';
import { BoardContext, type BoardContextValue } from './BoardContext';
import { BoardLooseCards } from './BoardLooseCards';
import { LOOSE_ROW_ID } from './looseRowId';
import { BoardGroup } from './BoardGroup';
import { BoardTiles } from './BoardTiles';
import { useBranchBoard } from './useBranchBoard';
import { useRemoveWorktrees } from './useRemoveWorktrees';

type Props = {
  readonly session: Session;
  readonly entries: ReadonlyArray<BranchEntry>;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
};

const NO_CARDS: ReadonlyArray<ActionCardModel> = [];

const SESSION_LEVEL_KINDS: ReadonlyArray<string> = ['archive-session', 'close-worktree'];

const MERGE_KIND = 'merge-series';

export const BranchBoard = ({ session, entries, cards: allCards, actionsFor, openFor }: Props) => {
  const cards = session.archivedAt == null ? allCards : NO_CARDS;
  const sessionId = session.id;
  const { board, kpis, entryByRowId, mergedAtByMountId, runningByRowId, newRowIds, now } =
    useBranchBoard({ session, entries });
  const [isMergedExpanded, setIsMergedExpanded] = useState(false);
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
  const rowIds = useMemo(() => new Set(rowById.keys()), [rowById]);
  const rowIdByAskId = useMemo(
    () => new Map(board.rows.flatMap((row) => row.askIds.map((askId) => [askId, row.id] as const))),
    [board.rows],
  );
  const cardsByRowId = useMemo(() => {
    const byRow = new Map<string, ReadonlyArray<ActionCardModel>>();
    for (const card of cards) {
      if (SESSION_LEVEL_KINDS.includes(card.kind) || card.kind === MERGE_KIND) {
        continue;
      }
      const rowId = cardRowIdOf({ card, rowIds, looseRowId: LOOSE_ROW_ID, rowIdByAskId });
      const key = rowId === LOOSE_ROW_ID || rowIds.has(rowId) ? rowId : LOOSE_ROW_ID;
      byRow.set(key, [...(byRow.get(key) ?? []), card]);
    }
    return byRow;
  }, [cards, rowIds, rowIdByAskId]);
  const mergeCard = useMemo(() => cards.find((card) => card.kind === MERGE_KIND) ?? null, [cards]);
  const groups = visibleGroupsOf({ board, isMergedExpanded });
  const firstOpenGroup = groups.find((group) => group.id !== 'merged')?.id ?? null;
  const value: BoardContextValue = {
    session,
    now,
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
  };
  return (
    <div data-slot="branch-board-section" className="flex min-w-0 flex-col gap-4">
      <BoardTiles kpis={kpis} />
      <BoardContext.Provider value={value}>
        <BoardLooseCards />
        {groups.length === 0 ? null : (
          <div
            role="region"
            aria-label="Branches"
            data-slot="branch-board"
            className="flex min-w-0 flex-col gap-4 rounded-lg bg-subtle p-3"
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
        )}
      </BoardContext.Provider>
    </div>
  );
};
