import { Fragment } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';
import { Tooltip } from './Tooltip';

export type StageTrackState = 'done' | 'current' | 'todo' | 'skipped';

export type StageTrackStage = {
  readonly id: string;
  readonly label: string;
  readonly state: StageTrackState;
};

export type StageTrackProps = {
  readonly stages: ReadonlyArray<StageTrackStage>;
  readonly tone: Tone;
  readonly className?: string;
};

const STATE_WORD: Readonly<Record<StageTrackState, string>> = {
  done: 'done',
  current: 'current',
  todo: 'to do',
  skipped: 'skipped',
};

type DotParams = {
  readonly state: StageTrackState;
  readonly tone: Tone;
};

const dotClassOf = ({ state, tone }: DotParams): string => {
  switch (state) {
    case 'done':
      return 'size-1.5 rounded-full bg-muted-foreground';
    case 'current':
      return cn('size-2.5 rounded-full', tintClasses(tone).dot);
    case 'todo':
      return 'size-1.5 rounded-full bg-transparent ring-1 ring-faint-foreground ring-inset';
    case 'skipped':
      return 'h-0.5 w-1.5 rounded-full bg-faint-foreground';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

type ReachParams = {
  readonly stages: ReadonlyArray<StageTrackStage>;
};

const reachedIndexOf = ({ stages }: ReachParams): number =>
  stages.reduce(
    (reached, stage, index) =>
      stage.state === 'done' || stage.state === 'current' ? index : reached,
    -1,
  );

const stageTrackLabelOf = ({ stages }: ReachParams): string =>
  stages.map((stage) => `${stage.label} ${STATE_WORD[stage.state]}`).join(', ');

export const StageTrack = ({ stages, tone, className }: StageTrackProps) => {
  const reached = reachedIndexOf({ stages });
  return (
    <span
      role="img"
      aria-label={stageTrackLabelOf({ stages })}
      data-stage-track=""
      className={cn('flex w-20 shrink-0 items-center', className)}
    >
      {stages.map((stage, index) => (
        <Fragment key={stage.id}>
          {index === 0 ? null : (
            <span
              data-stage-line={index <= reached ? 'filled' : 'empty'}
              className={cn(
                'h-px min-w-0 flex-1',
                index <= reached ? 'bg-muted-foreground' : 'bg-border',
              )}
            />
          )}
          <Tooltip content={`${stage.label} ${STATE_WORD[stage.state]}`}>
            <span
              data-stage={stage.id}
              data-stage-state={stage.state}
              className={cn('shrink-0', dotClassOf({ state: stage.state, tone }))}
            />
          </Tooltip>
        </Fragment>
      ))}
    </span>
  );
};
