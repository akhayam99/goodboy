import { useMemo, useState } from 'react';
import { SectionLabel } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useMountDiffStats } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import type { BoardCards } from '../../central/board/boardCardsOf';
import { projectBlocksOf } from '../../central/board/projectBlocksOf';
import { MountProjectAction } from '../SessionOverviewPane/ProjectMountRows/MountProjectAction';
import { BoardProjectRemovals } from './BoardProjectRemovals';
import { BoardContext, type BoardContextValue } from './BoardContext';
import { ProjectBlock } from './ProjectBlock';
import type { BranchBoardView } from './useBranchBoard';
import { useRemoveWorktrees } from './useRemoveWorktrees';

type Props = {
  readonly session: Session;
  readonly view: BranchBoardView;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly cardsByRowId: BoardCards['byRowId'];
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly shownAskIds: ReadonlySet<string>;
  readonly isPermissionShown: boolean;
};

type ToggleParams = {
  readonly id: string;
};

const NO_CARDS: ReadonlyArray<ActionCardModel> = [];

const NO_PLACED: BoardCards['byRowId'] = new Map();

const MERGE_KIND = 'merge-series';

export const ProjectBlocks = ({
  session,
  view,
  cards: allCards,
  cardsByRowId: placedByRowId,
  actionsFor,
  openFor,
  shownAskIds,
  isPermissionShown,
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
  const cardsByRowId = session.archivedAt == null ? placedByRowId : NO_PLACED;
  const mergeCard = useMemo(() => cards.find((card) => card.kind === MERGE_KIND) ?? null, [cards]);
  const blocks = useMemo(
    () => projectBlocksOf({ board, rowById, expandedIds }),
    [board, expandedIds, rowById],
  );
  const removeDoorId =
    blocks.find((block) => block.rowIds.some((rowId) => rowById.get(rowId)?.isMerged === true))
      ?.id ?? null;
  const hasMergeDoor = mergeCard !== null && actionsFor({ card: mergeCard }).main !== null;
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
    shownAskIds,
    isPermissionShown,
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
        {session.archivedAt == null ? (
          <div data-section-actions="" className="flex min-w-0 items-center gap-2">
            <MountProjectAction
              sessionId={sessionId}
              workspaceId={session.workspaceId}
              presentation="button"
            />
          </div>
        ) : null}
      </div>
      <BoardProjectRemovals sessionId={sessionId} />
      <BoardContext.Provider value={value}>
        {blocks.map((block, index) => (
          <ProjectBlock
            key={block.id}
            block={block}
            hasMergeDoor={hasMergeDoor && index === 0}
            hasRemoveDoor={block.id === removeDoorId && !(hasMergeDoor && index === 0)}
            onToggleFold={() => toggle({ id: block.id })}
          />
        ))}
      </BoardContext.Provider>
    </section>
  );
};
