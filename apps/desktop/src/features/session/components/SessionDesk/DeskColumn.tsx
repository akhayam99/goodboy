import { HeightMotion, PANE_GROUPS_GAP_REM, PANE_RHYTHM, ScrollFade, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionAskLine } from '../../ask/components/SessionAskLine';
import { NeedsYouSection } from '../SessionOverviewPane/NeedsYouSection';
import { NextSection } from '../SessionOverviewPane/NextSection';
import { NowSection } from '../SessionOverviewPane/NowSection';
import { OverviewStatus } from '../SessionOverviewPane/OverviewStatus';
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
  const isAskShown = !model.isArchived && !model.isEmpty && !isInPopover;
  return (
    <div
      data-desk-column=""
      className={cn('flex min-h-0 min-w-0 flex-col', isInPopover ? 'p-3' : 'h-full')}
    >
      <ScrollFade
        className="flex min-h-0 flex-1 flex-col"
        viewportClassName={cn('flex min-h-0 flex-1 flex-col', PANE_RHYTHM.groups)}
      >
        {model.isEmpty ? null : (
          <OverviewStatus
            sessionId={sessionId}
            status={model.status}
            elapsedMs={model.board.kpis.elapsedMs}
          />
        )}
        <HeightMotion isOpen={model.hasNeedsYou} parentGapRem={PANE_GROUPS_GAP_REM}>
          <NeedsYouSection
            sessionId={sessionId}
            cards={model.moves.needsYou}
            questions={model.looseQuestions}
            actionsFor={model.actionsFor}
            openFor={model.openFor}
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
          openFor={model.openFor}
          hasFilledMove={!model.hasNeedsYou}
        />
        <DeskProjects sessionId={sessionId} board={model.board} />
      </ScrollFade>
      {isAskShown ? (
        <div data-desk-ask="" className="shrink-0 bg-background">
          <SessionAskLine sessionId={sessionId} />
        </div>
      ) : null}
    </div>
  );
};
