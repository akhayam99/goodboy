import { useRef } from 'react';
import { HeightMotion, PANE_GROUPS_GAP_REM, PANE_RHYTHM, ScrollFade, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useMoveKeys } from '../../hooks/useMoveKeys';
import { NeedsYouSection } from '../SessionOverviewPane/NeedsYouSection';
import { NextSection } from '../SessionOverviewPane/NextSection';
import { NowSection } from '../SessionOverviewPane/NowSection';
import { OverviewFacts } from '../SessionOverviewPane/OverviewFacts';
import type { useOverviewModel } from '../SessionOverviewPane/useOverviewModel';
import { DeskProjects } from './DeskProjects';

type Props = {
  readonly session: Session;
  readonly model: ReturnType<typeof useOverviewModel>;
  readonly isInPopover: boolean;
};

const DESK_NEXT_CAP = 2;

export const DeskColumn = ({ session, model, isInPopover }: Props) => {
  const sessionId = session.id;
  const columnRef = useRef<HTMLDivElement>(null);
  useMoveKeys({
    sessionId,
    face: 'desk',
    containerRef: columnRef,
    moves: model.moves,
    actionsFor: model.actionsFor,
  });
  return (
    <div
      ref={columnRef}
      data-desk-column=""
      className={cn('flex min-h-0 min-w-0 flex-col', isInPopover ? 'p-3' : 'h-full')}
    >
      <ScrollFade
        className="flex min-h-0 flex-1 flex-col"
        viewportClassName={cn('flex min-h-0 flex-1 flex-col', PANE_RHYTHM.groups)}
      >
        {model.isEmpty ? null : (
          <OverviewFacts sessionId={sessionId} elapsedMs={model.board.kpis.elapsedMs} />
        )}
        <HeightMotion isOpen={model.hasNeedsYou} parentGapRem={PANE_GROUPS_GAP_REM}>
          <NeedsYouSection
            sessionId={sessionId}
            cards={model.moves.needsYou}
            questions={model.looseQuestions}
            permission={model.permission}
            actionsFor={model.actionsFor}
            kickerById={model.kickerById}
          />
        </HeightMotion>
        <HeightMotion isOpen={model.isNowShown} parentGapRem={PANE_GROUPS_GAP_REM}>
          <NowSection sessionId={sessionId} model={model.now} />
        </HeightMotion>
        <NextSection
          sessionId={sessionId}
          cards={model.moves.next.slice(0, DESK_NEXT_CAP)}
          actionsFor={model.actionsFor}
          hasFilledMove={!model.hasNeedsYou}
        />
        <DeskProjects sessionId={sessionId} board={model.board} />
      </ScrollFade>
    </div>
  );
};
