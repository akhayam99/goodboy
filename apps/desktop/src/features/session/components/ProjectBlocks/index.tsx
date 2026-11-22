import { useMemo, useState, type ReactNode } from 'react';
import { SectionLabel } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useMountDiffStats } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { cardRowIdOf } from '../../central/board/cardRowIdOf';
import { projectBlocksOf } from '../../central/board/projectBlocksOf';
import { BoardProjectRemovals } from './BoardProjectRemovals';
import { BoardContext, type BoardContextValue } from './BoardContext';
import { ProjectBlock } from './ProjectBlock';
import type { BranchBoardView } from './useBranchBoard';
import { useRemoveWorktrees } from './useRemoveWorktrees';

type Props = {
  readonly session: Session;
  readonly view: BranchBoardView;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly isDevShown: boolean;
  readonly shownAskIds: ReadonlySet<string>;
  readonly devToggle?: ReactNode;
};

type ToggleParams = {
  readonly id: string;
};

const NO_CARDS: ReadonlyArray<ActionCardModel> = [];

const SESSION_LEVEL_KINDS: ReadonlyArray<string> = ['archive-session', 'close-worktree'];

const MERGE_KIND = 'merge-series';

const LOOSE_ROW_ID = 'loose';

export const ProjectBlocks = ({
  session,
  view,
  cards: allCards,
  actionsFor,
  openFor,
  isDevShown,
  shownAskIds,
  devToggle,
}: Props) => {
  const cards = session.archivedAt == null ? allCards : NO_CARDS;
  const sessionId = session.id;
  const { board, entryByRowId, settledAtByMountId, runningByRowId, newRowIds, now } = view;
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
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
      if (!rowIds.has(rowId)) {
        continue;
      }
      byRow.set(rowId, [...(byRow.get(rowId) ?? []), card]);
    }
    return byRow;
  }, [cards, rowIds, rowIdByAskId]);
  const mergeCard = useMemo(() => cards.find((card) => card.kind === MERGE_KIND) ?? null, [cards]);
  const blocks = useMemo(
    () => projectBlocksOf({ board, rowById, expandedIds }),
    [board, expandedIds, rowById],
  );
  const removeDoorId =
    blocks.find((block) => block.rowIds.some((rowId) => rowById.get(rowId)?.isMerged === true))
      ?.id ?? null;
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
    isDevShown,
    shownAskIds,
  };
  const toggle = ({ id }: ToggleParams) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  return (
    <section
      aria-label={NAMES.projects}
      data-slot="project-blocks"
      className="relative flex min-w-0 flex-col gap-2"
    >
      <div className="flex h-7 min-w-0 items-center justify-between gap-2">
        <SectionLabel label={NAMES.projects} headingLevel={2} />
        {devToggle}
      </div>
      <BoardProjectRemovals sessionId={sessionId} />
      <BoardContext.Provider value={value}>
        {blocks.map((block, index) => (
          <ProjectBlock
            key={block.id}
            block={block}
            hasMergeDoor={index === 0}
            hasRemoveDoor={block.id === removeDoorId}
            onToggleFold={() => toggle({ id: block.id })}
          />
        ))}
      </BoardContext.Provider>
    </section>
  );
};
