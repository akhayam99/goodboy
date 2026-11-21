import { useMemo, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useMountDiffStats } from '../../../../store';
import type { BranchEntry } from '../../central/branches/branchStoryOf';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import type { BoardGroupId } from '../../central/board/boardTypes';
import { cardRowIdOf } from '../../central/board/cardRowIdOf';
import { visibleGroupsOf } from '../../central/board/visibleGroupsOf';
import { boardProjectsOf } from '../../central/board/boardProjectsOf';
import { BoardProjectHead } from './BoardProjectHead';
import { BoardProjectRemovals } from './BoardProjectRemovals';
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
  const { board, kpis, entryByRowId, settledAtByMountId, runningByRowId, newRowIds, now } =
    useBranchBoard({ session, entries });
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<BoardGroupId>>(new Set());
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
  const projects = useMemo(() => boardProjectsOf({ rows: board.rows }), [board.rows]);
  const soleProject = projects.length === 1 ? (projects[0] ?? null) : null;
  const groups = visibleGroupsOf({ board, expandedGroupIds });
  const firstOpenGroup =
    groups.find((group) => group.id !== 'merged' && group.id !== 'closed')?.id ?? null;
  const value: BoardContextValue = {
    session,
    now,
    rowById,
    entryByRowId,
    runningByRowId,
    settledAtByMountId,
    newRowIds,
    diffStatByPath,
    cardsByRowId,
    mergeCard,
    actionsFor,
    openFor,
    removal,
    isMultiProject: projects.length > 1,
  };
  return (
    <div data-slot="branch-board-section" className="relative flex min-w-0 flex-col gap-4">
      <BoardProjectRemovals sessionId={sessionId} />
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
            {soleProject === null ? null : (
              <BoardProjectHead
                projectId={soleProject.projectId}
                projectName={soleProject.projectName}
                count={null}
              />
            )}
            {groups.map((group) => (
              <BoardGroup
                key={group.id}
                group={group}
                isFirstOpenGroup={group.id === firstOpenGroup}
                onShowMore={() =>
                  setExpandedGroupIds((current) => {
                    const next = new Set(current);
                    if (!next.delete(group.id)) {
                      next.add(group.id);
                    }
                    return next;
                  })
                }
              />
            ))}
          </div>
        )}
      </BoardContext.Provider>
    </div>
  );
};
