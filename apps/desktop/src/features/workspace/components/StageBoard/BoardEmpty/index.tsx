import { Plus } from 'lucide-react';
import { Button, cn, EmptyState, Eyebrow, ICON_SIZE, PANE_RHYTHM, ScrollFade } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { dispatchWindowEvent } from '../../../../../shared/lib/dispatchWindowEvent';
import { sentenceCase } from '../../../../../shared/utils/sentenceCase';
import { describeStageBucket } from '../../../../session/session-stage';
import { BOARD_STAGES } from '../boardStages';
import { promiseOf } from './promiseOf';

export const BoardEmpty = () => (
  <div data-slot="board-empty" className="flex min-h-0 min-w-0 flex-1 flex-col">
    <EmptyState
      icon={CONCEPT_ICONS.sessions}
      title="No sessions yet"
      description="A session holds one goal, its agents and, for code, a branch."
      size="page"
      headingLevel={2}
    />
    <ScrollFade orientation="horizontal" fadeSize="w-8" className="min-h-0 flex-1">
      <div className={cn('grid', PANE_RHYTHM.board.laneGap, PANE_RHYTHM.board.lanesFive)}>
        {BOARD_STAGES.map((stage, index) => (
          <div
            key={stage}
            role="group"
            aria-label={sentenceCase({ text: describeStageBucket({ stage }).label })}
            className={cn(
              'flex min-w-0 flex-col items-start rounded-lg bg-subtle p-3',
              PANE_RHYTHM.board.laneStack,
            )}
          >
            <Eyebrow label={sentenceCase({ text: describeStageBucket({ stage }).label })} muted />
            <p className="text-meta text-faint-foreground">{promiseOf({ stage })}</p>
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
