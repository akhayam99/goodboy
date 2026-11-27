import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../../store';
import { useNow } from '../../../../../shared/hooks/useNow';
import { autoRetryTargetsOf } from '../../../../auto/autoRetryTargetsOf';
import { branchEntriesOf } from '../../../central/branches/branchStoryOf';
import { useBranchDetails } from '../../../central/branches/useBranchDetails';
import { useBranchFacts } from '../../../central/branches/useBranchFacts';
import { cardsOutsideRunningOf } from '../../../central/cards/cardsOutsideRunningOf';
import { cardsOnBoardOf } from '../../../central/next/cardsOnBoardOf';
import { overviewMovesOf } from '../../../central/next/overviewMovesOf';
import { useNextCards } from '../../../central/next/useNextCards';
import { boardCardsOf } from '../../../central/board/boardCardsOf';
import { useLiveGroups } from '../../../central/now/useLiveGroups';
import { useNowModel } from '../../../central/now/hooks/useNowModel';
import { overviewHasContentOf } from '../../../central/overviewHasContentOf';
import { useSessionWorkModel } from '../../../central/useSessionWorkModel';
import { attentionReasonsOf } from '../../../../../store/slices/session-view/attentionReasonsOf';
import { cachedStageInfoOf } from '../../../../../store/slices/session-view/cachedStageInfoOf';
import { sessionSettleOf } from '../../../../../store/slices/session-view/settle/sessionSettleOf';
import { inPlaceFoldersOf } from '../../../../../store/slices/project-mounts/inPlaceFoldersOf';
import { useBranchNotes } from '../../../../resolve/notes/useBranchNotes';
import { useBranchBoard } from '../../ProjectBlocks/useBranchBoard';
import { useArchivedWorkRecord } from '../useArchivedWorkRecord';
import { useIsEmptySession } from '../useIsEmptySession';
import { useOverviewNotices } from '../useOverviewNotices';
import { useSessionPermissionAsk } from '../useSessionPermissionAsk';

type Params = {
  readonly session: Session;
};

const AUTO_CLOCK_MS = 15_000;

export const useOverviewModel = ({ session }: Params) => {
  const sessionId = session.id;
  const isArchived = session.archivedAt != null;
  useArchivedWorkRecord({ session });
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, model.autoTrees.length > 0);
  const settledAt = useAppStore((state) => sessionSettleOf({ state, sessionId }).settledAt);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock, settledAt }),
    [agents, clock, model.autoTrees, settledAt],
  );
  const { cards, actionsFor } = useNextCards({ session, model, autoTargets });
  const groups = useLiveGroups({ model, agents, now: clock });
  const boardInfo = useAppStore((state) => cachedStageInfoOf({ state, session }));
  const boardReasons = useMemo(() => attentionReasonsOf({ info: boardInfo }), [boardInfo]);
  const moves = useMemo(
    () =>
      overviewMovesOf({
        cards: isArchived
          ? EMPTY_ARRAY
          : cardsOnBoardOf({
              cards: cardsOutsideRunningOf({ cards, groups }),
              reasons: boardReasons,
            }),
      }),
    [boardReasons, cards, groups, isArchived],
  );
  const openQuestions = useSessionOpenQuestions(sessionId);
  const looseQuestions = useMemo(
    () =>
      isArchived
        ? EMPTY_ARRAY
        : openQuestions.filter((question) => !moves.shownAskIds.has(question.id)),
    [isArchived, moves.shownAskIds, openQuestions],
  );
  const shownAskIds = useMemo(
    () => new Set([...moves.shownAskIds, ...looseQuestions.map((question) => question.id)]),
    [looseQuestions, moves.shownAskIds],
  );
  const permission = useSessionPermissionAsk({ sessionId, isEnabled: !isArchived });
  const hasNeedsYou = moves.needsYou.length > 0 || looseQuestions.length > 0 || permission !== null;
  const { facts } = useBranchFacts({ sessionId, groups });
  const detailByMountId = useBranchDetails({ sessionId, facts });
  const branches = useMemo(
    () => branchEntriesOf({ facts, detailByMountId }),
    [detailByMountId, facts],
  );
  const entries = useMemo(
    () => [...branches.live, ...branches.finished],
    [branches.finished, branches.live],
  );
  const board = useBranchBoard({ session, entries });
  const placed = useMemo(
    () => boardCardsOf({ cards: moves.rest, rows: board.board.rows }),
    [board.board.rows, moves.rest],
  );
  const now = useNowModel({ sessionId, groups });
  const kickerById = useMemo(() => {
    const projectByMount = new Map<string, string>(
      entries.map((entry) => [entry.fact.mountId, entry.fact.projectName]),
    );
    return new Map(
      moves.needsYou.flatMap((card) => {
        const project = card.mountId === null ? undefined : projectByMount.get(card.mountId);
        return project === undefined ? [] : [[card.id, project] as const];
      }),
    );
  }, [entries, moves.needsYou]);
  const noticesView = useOverviewNotices({ sessionId, isEnabled: !isArchived });
  const hasFolders = useAppStore((state) => inPlaceFoldersOf({ state, sessionId }).length > 0);
  const { unassigned } = useBranchNotes({ sessionId });
  const hasContent =
    overviewHasContentOf({
      shown: [],
      entries,
      hasFolders,
      hasUnassignedNotes: unassigned.length > 0,
      hasClosedWorktree: noticesView.rows.some((row) => !row.isAttached),
    }) ||
    cards.length > 0 ||
    groups.length > 0 ||
    noticesView.notices.length > 0;
  const isEmpty = useIsEmptySession({ session, hasContent });
  const nowCount = now.rows.length + now.waits.length;
  const isNowShown = nowCount > 0;
  return {
    isArchived,
    isEmpty,
    actionsFor,
    moves,
    looseQuestions,
    permission,
    shownAskIds,
    hasNeedsYou,
    kickerById,
    board,
    placed,
    now,
    nowCount,
    isNowShown,
    noticesView,
  };
};
