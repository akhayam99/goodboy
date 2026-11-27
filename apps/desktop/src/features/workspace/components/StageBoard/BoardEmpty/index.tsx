import { Plus } from '@goodboy/ui/icons';
import { Button, cn, EmptyState, Eyebrow, ICON_SIZE, PANE_RHYTHM, ScrollFade } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { dispatchWindowEvent } from '../../../../../shared/lib/dispatchWindowEvent';
import { sentenceCase } from '../../../../../shared/utils/sentenceCase';
import { ARCHIVED_LANE, describeStageBucket } from '../../../../session/session-stage';
import { BOARD_LANE_SPECS, type BoardLaneSpec } from '../boardLaneSpecs';
import { promiseOf } from './promiseOf';

type LabelParams = {
  readonly spec: BoardLaneSpec;
};

const emptyLaneLabelOf = ({ spec }: LabelParams): string =>
  sentenceCase({
    text:
      spec.kind === 'archived'
        ? ARCHIVED_LANE.label
        : describeStageBucket({ stage: spec.stage }).label,
  });

export const BoardEmpty = () => (
  <div data-slot="board-empty" className="flex min-h-0 min-w-0 flex-1 flex-col">
    <EmptyState
      icon={CONCEPT_ICONS.board}
      title="No sessions yet"
      description="A session holds one goal, its agents and, for code, a branch."
      size="page"
      headingLevel={2}
    />
    <ScrollFade orientation="horizontal" fadeSize="w-8" className="min-h-0 flex-1">
      <div className={cn('grid', PANE_RHYTHM.board.laneGap, PANE_RHYTHM.board.lanesFive)}>
        {BOARD_LANE_SPECS.map((spec, index) => (
          <div
            key={spec.kind === 'archived' ? 'archived' : spec.stage}
            role="group"
            aria-label={emptyLaneLabelOf({ spec })}
            className={cn(
              'flex min-w-0 flex-col items-start rounded-lg bg-subtle p-3',
              PANE_RHYTHM.board.laneStack,
            )}
          >
            <Eyebrow label={emptyLaneLabelOf({ spec })} muted />
            <p className="text-meta text-faint-foreground">{promiseOf({ spec })}</p>
            {index === 0 ? (
              <Button
                size="md"
                onClick={() => dispatchWindowEvent({ name: 'goodboy:new-session' })}
              >
                <Plus size={ICON_SIZE.control} aria-hidden />
                New session
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </ScrollFade>
  </div>
);
