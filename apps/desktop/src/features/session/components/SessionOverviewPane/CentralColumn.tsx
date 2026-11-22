import { useMemo } from 'react';
import { Button, HeightMotion, PANE_GROUPS_GAP_REM, PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/utils/names';
import { autoRetryTargetsOf } from '../../../auto/autoRetryTargetsOf';
import { branchEntriesOf } from '../../central/branches/branchStoryOf';
import { overviewStatusOf } from '../../central/branches/overviewStatusOf';
import { useBranchDetails } from '../../central/branches/useBranchDetails';
import { useBranchFacts } from '../../central/branches/useBranchFacts';
import { cardsOutsideRunningOf } from '../../central/cards/cardsOutsideRunningOf';
import { overviewMovesOf } from '../../central/next/overviewMovesOf';
import { useNextCards } from '../../central/next/useNextCards';
import { boardCardsOf } from '../../central/board/boardCardsOf';
import { useLiveGroups } from '../../central/now/useLiveGroups';
import { useNowModel } from '../../central/now/hooks/useNowModel';
import { overviewHasContentOf } from '../../central/overviewHasContentOf';
import { useSessionWorkModel } from '../../central/useSessionWorkModel';
import { inPlaceFoldersOf } from '../../../../store/slices/project-mounts/inPlaceFoldersOf';
import { useBranchNotes } from '../../../resolve/notes/useBranchNotes';
import { SessionAskLine } from '../../ask/components/SessionAskLine';
import { ProjectBlocks } from '../ProjectBlocks';
import { useBranchBoard } from '../ProjectBlocks/useBranchBoard';
import { EmptySessionStart } from './EmptySessionStart';
import { FolderCard } from './FolderCard';
import { NeedsYouSection } from './NeedsYouSection';
import { NextOverflow } from './NextOverflow';
import { NextSection } from './NextSection';
import { NowSection } from './NowSection';
import { OverviewLog } from './OverviewLog';
import { OverviewNotices } from './OverviewNotices';
import { OverviewStatus } from './OverviewStatus';
import { UnassignedNotes } from './UnassignedNotes';
import { useDevDetails } from './useDevDetails';
import { useIsEmptySession } from './useIsEmptySession';
import { useOverviewNotices } from './useOverviewNotices';

type Props = {
  readonly session: Session;
};

const AUTO_CLOCK_MS = 15_000;

export const CentralColumn = ({ session }: Props) => {
  const sessionId = session.id;
  const isArchived = session.archivedAt != null;
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, model.autoTrees.length > 0);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock }),
    [agents, clock, model.autoTrees],
  );
  const { cards, actionsFor, openFor } = useNextCards({ session, model, autoTargets });
  const groups = useLiveGroups({ model, agents, now: clock });
  const moves = useMemo(
    () =>
      overviewMovesOf({
        cards: isArchived ? EMPTY_ARRAY : cardsOutsideRunningOf({ cards, groups }),
      }),
    [cards, groups, isArchived],
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
  const hasNeedsYou = moves.needsYou.length > 0 || looseQuestions.length > 0;
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
  const status = useMemo(() => overviewStatusOf({ branches }), [branches]);
  const now = useNowModel({ sessionId, groups });
  const dev = useDevDetails({ workspaceId: session.workspaceId });
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
  const noticeCount = noticesView.notices.length;
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
    noticeCount > 0;
  const isEmpty = useIsEmptySession({ session, hasContent });
  const isAskPanelOpen = useAppStore(
    (state) => state.drawer?.kind === 'ask' && state.drawer.sessionId === sessionId,
  );
  const isNowShown = now.rows.length > 0 || now.waits.length > 0;
  return (
    <div data-central-column className={PANE_RHYTHM.groups}>
      {isEmpty ? null : (
        <OverviewStatus sessionId={sessionId} status={status} elapsedMs={board.kpis.elapsedMs} />
      )}
      {isArchived ? null : (
        <HeightMotion
          isOpen={noticesView.rows.length > 0 || noticesView.isPublishShown}
          parentGapRem={PANE_GROUPS_GAP_REM}
        >
          <OverviewNotices session={session} view={noticesView} />
        </HeightMotion>
      )}
      {isArchived ? null : <UnassignedNotes sessionId={sessionId} />}
      {isEmpty ? <EmptySessionStart session={session} /> : null}
      <HeightMotion isOpen={hasNeedsYou} parentGapRem={PANE_GROUPS_GAP_REM}>
        <NeedsYouSection
          sessionId={sessionId}
          cards={moves.needsYou}
          questions={looseQuestions}
          actionsFor={actionsFor}
          openFor={openFor}
          kickerById={kickerById}
        />
      </HeightMotion>
      <HeightMotion isOpen={isNowShown} parentGapRem={PANE_GROUPS_GAP_REM}>
        <NowSection sessionId={sessionId} model={now} />
      </HeightMotion>
      <NextSection
        sessionId={sessionId}
        cards={moves.next}
        actionsFor={actionsFor}
        openFor={openFor}
        hasFilledMove={!hasNeedsYou}
      />
      <NextOverflow
        sessionId={sessionId}
        cards={placed.loose}
        actionsFor={actionsFor}
        openFor={openFor}
      />
      {isEmpty || board.board.rows.length === 0 ? null : (
        <ProjectBlocks
          key={sessionId}
          session={session}
          view={board}
          cards={moves.rest}
          cardsByRowId={placed.byRowId}
          actionsFor={actionsFor}
          openFor={openFor}
          isDevShown={dev.isShown}
          shownAskIds={shownAskIds}
          devToggle={
            <Button size="sm" variant="quiet" aria-pressed={dev.isShown} onClick={dev.toggle}>
              {dev.isShown ? NAMES.hideDevDetails : NAMES.showDevDetails}
            </Button>
          }
        />
      )}
      {isArchived || isEmpty ? null : <FolderCard sessionId={sessionId} />}
      {isEmpty ? null : <OverviewLog session={session} />}
      {isArchived || isEmpty || isAskPanelOpen ? null : (
        <div data-overview-ask="" className="sticky bottom-0 bg-background">
          <SessionAskLine sessionId={sessionId} />
        </div>
      )}
    </div>
  );
};
