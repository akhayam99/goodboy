import { useRef } from 'react';
import { HeightMotion, PANE_GROUPS_GAP_REM, PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AskFoot } from '../../ask/components/AskFoot';
import { useMoveKeys } from '../../hooks/useMoveKeys';
import { ProjectBlocks } from '../ProjectBlocks';
import { EmptySessionStart } from './EmptySessionStart';
import { FolderCard } from './FolderCard';
import { NeedsYouSection } from './NeedsYouSection';
import { NextOverflow } from './NextOverflow';
import { NextSection } from './NextSection';
import { NowSection } from './NowSection';
import { OverviewLog } from './OverviewLog';
import { OverviewNotices } from './OverviewNotices';
import { OverviewFacts } from './OverviewFacts';
import { UnassignedNotes } from './UnassignedNotes';
import { useOverviewModel } from './useOverviewModel';

type Props = {
  readonly session: Session;
};

export const CentralColumn = ({ session }: Props) => {
  const sessionId = session.id;
  const {
    isArchived,
    isEmpty,
    actionsFor,
    moves,
    looseQuestions,
    shownAskIds,
    hasNeedsYou,
    kickerById,
    board,
    placed,
    now,
    isNowShown,
    noticesView,
  } = useOverviewModel({ session });
  const columnRef = useRef<HTMLDivElement>(null);
  useMoveKeys({ sessionId, face: 'overview', containerRef: columnRef, moves, actionsFor });
  return (
    <div ref={columnRef} data-central-column className={PANE_RHYTHM.groups}>
      {isEmpty ? null : <OverviewFacts sessionId={sessionId} elapsedMs={board.kpis.elapsedMs} />}
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
        hasFilledMove={!hasNeedsYou}
      />
      <NextOverflow sessionId={sessionId} cards={placed.loose} actionsFor={actionsFor} />
      {isEmpty || board.board.rows.length === 0 ? null : (
        <ProjectBlocks
          key={sessionId}
          session={session}
          view={board}
          cards={moves.rest}
          cardsByRowId={placed.byRowId}
          actionsFor={actionsFor}
          shownAskIds={shownAskIds}
        />
      )}
      {isArchived || isEmpty ? null : <FolderCard sessionId={sessionId} />}
      {isEmpty ? null : <OverviewLog session={session} />}
      {isArchived || isEmpty ? null : <AskFoot session={session} />}
    </div>
  );
};
