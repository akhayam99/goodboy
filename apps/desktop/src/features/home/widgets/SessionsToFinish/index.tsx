import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { HOME_WIDGETS, type WidgetSize } from '../../grid/homeWidgets';
import { openBoard } from '../../openBoard';
import type { HomeFacts } from '../../hooks/useHomeFacts';
import { HeroNumber } from '../../WidgetCard/HeroNumber';
import { WidgetCard } from '../../WidgetCard';
import { WidgetSkeleton } from '../../WidgetCard/WidgetSkeleton';
import { StageBar } from './StageBar';
import { StageLegend } from './StageLegend';
import { segmentsOf } from './segmentsOf';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

export const SessionsToFinish = ({ facts, size }: Props) => {
  const segments = segmentsOf({ counts: facts.counts });
  const number = <HeroNumber value={String(facts.toFinish)} unit="left" />;
  return (
    <WidgetCard
      id="sessionsToFinish"
      title={HOME_WIDGETS.sessionsToFinish.title}
      icon={CONCEPT_ICONS.board}
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading sessions to finish" />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          {number}
          <StageBar segments={segments} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {number}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <StageBar segments={segments} />
            <div className="flex min-w-0 items-center justify-between gap-3">
              <StageLegend segments={segments} />
              {size === 'L' ? (
                <Button size="xs" variant="quiet" onClick={openBoard}>
                  Open {NAMES.board}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
};
