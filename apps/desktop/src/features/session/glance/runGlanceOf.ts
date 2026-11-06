import { pluralize } from '../../../shared/utils/pluralize';
import type { RunPrimaryKind } from '../../workflows/runPrimaryOf';
import { glanceOf, type Glance } from './glanceOf';

type Params = {
  readonly isDiscarded: boolean;
  readonly isCompleted: boolean;
  readonly isDynamic: boolean;
  readonly doneCount: number;
  readonly stepCount: number;
  readonly primary: RunPrimaryKind | null;
};

type StepsParams = Pick<Params, 'doneCount' | 'stepCount' | 'isDynamic'>;

const stepsSentenceOf = ({ doneCount, stepCount, isDynamic }: StepsParams): string => {
  if (isDynamic || stepCount === 0) {
    return doneCount === 0 ? 'Nothing ran yet' : `${pluralize(doneCount, 'agent')} finished`;
  }
  return `${doneCount} of ${pluralize(stepCount, 'step')}`;
};

const PRIMARY_GLANCE: Readonly<Record<Exclude<RunPrimaryKind, 'continue'>, Glance>> = {
  'review-plan': glanceOf({ state: 'waiting', sentence: 'The plan needs your OK' }),
  'approve-plan': glanceOf({ state: 'waiting', sentence: 'The plan needs your OK' }),
  answer: glanceOf({ state: 'waiting', sentence: 'A question needs your answer' }),
  'decide-next': glanceOf({ state: 'waiting', sentence: 'Decide what happens next' }),
  resume: glanceOf({ state: 'idle', sentence: 'The run is paused' }),
  'start-step': glanceOf({ state: 'idle', sentence: 'Ready for the next step' }),
  'start-run': glanceOf({ state: 'idle', sentence: 'Ready to start' }),
  retry: glanceOf({ state: 'stuck', sentence: 'A step failed' }),
  hint: glanceOf({ state: 'stuck', sentence: 'The run needs a hint' }),
  'raise-cap': glanceOf({ state: 'stuck', sentence: 'Paused at the limit' }),
  restore: glanceOf({ state: 'stopped', sentence: 'This run was discarded' }),
};

export const runGlanceOf = ({
  isDiscarded,
  isCompleted,
  isDynamic,
  doneCount,
  stepCount,
  primary,
}: Params): Glance => {
  if (isDiscarded) {
    return PRIMARY_GLANCE.restore;
  }
  if (isCompleted) {
    return glanceOf({
      state: 'done',
      sentence: stepsSentenceOf({ doneCount, stepCount, isDynamic }),
    });
  }
  if (primary === 'continue') {
    return glanceOf({
      state: 'stopped',
      sentence: stepsSentenceOf({ doneCount, stepCount, isDynamic }),
    });
  }
  if (primary !== null) {
    return PRIMARY_GLANCE[primary];
  }
  const isStarting = isDynamic && doneCount === 0;
  return glanceOf({
    state: 'working',
    sentence: isStarting ? 'Getting started' : stepsSentenceOf({ doneCount, stepCount, isDynamic }),
  });
};
