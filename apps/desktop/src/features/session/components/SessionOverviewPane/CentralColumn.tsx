import { useMemo } from 'react';
import { HeightMotion, PANE_GROUPS_GAP_REM, PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { autoRetryTargetsOf } from '../../../auto/autoRetryTargetsOf';
import { branchEntriesOf } from '../../central/branches/branchStoryOf';
import { useBranchDetails } from '../../central/branches/useBranchDetails';
import { useBranchFacts } from '../../central/branches/useBranchFacts';
import { cardsOutsideRunningOf } from '../../central/cards/cardsOutsideRunningOf';
import { useNextCards } from '../../central/next/useNextCards';
import { useLiveGroups } from '../../central/now/useLiveGroups';
import { overviewHasContentOf } from '../../central/overviewHasContentOf';
import { useSessionWorkModel } from '../../central/useSessionWorkModel';
import { inPlaceFoldersOf } from '../../../../store/slices/project-mounts/inPlaceFoldersOf';
import { useBranchNotes } from '../../../resolve/notes/useBranchNotes';
import { BranchBoard } from '../BranchBoard';
import { ChatOriginRow } from './ChatOriginRow';
import { EmptySessionStart } from './EmptySessionStart';
import { FolderCard } from './FolderCard';
import { OverviewNotices } from './OverviewNotices';
import { UnassignedNotes } from './UnassignedNotes';
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
  const nextCards = useMemo(() => cardsOutsideRunningOf({ cards, groups }), [cards, groups]);
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
    nextCards.length > 0 ||
    groups.length > 0 ||
    noticeCount > 0;
  const isEmpty = useIsEmptySession({ session, hasContent });
  return (
    <div data-central-column className={PANE_RHYTHM.groups}>
      <ChatOriginRow session={session} />
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
      {isEmpty ? null : (
        <BranchBoard
          key={sessionId}
          session={session}
          entries={entries}
          cards={nextCards}
          actionsFor={actionsFor}
          openFor={openFor}
        />
      )}
      {isArchived || isEmpty ? null : <FolderCard sessionId={sessionId} />}
    </div>
  );
};
