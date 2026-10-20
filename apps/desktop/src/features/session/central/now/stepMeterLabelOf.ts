import type { RunStepState } from '../../timeline/runStepProgress';
import type { LiveRunGroup } from './liveGroupsOf';
import { runPositionOf } from './runPositionOf';

type Params = {
  readonly group: LiveRunGroup;
};

const STATE_PHRASE: Record<RunStepState, string> = {
  done: 'done',
  running: 'running',
  waiting: 'waits on you',
  failed: 'failed',
  notStarted: 'not started',
};

export const stepMeterLabelOf = ({ group }: Params): string => {
  const position = runPositionOf({ group });
  const { currentStep, waitingStepNumber } = group;
  if (position === null || currentStep === null) {
    return position ?? 'No step started';
  }
  const currentState = group.stepStates[currentStep.number - 1] ?? 'running';
  const head = `${position}, ${currentStep.title} ${STATE_PHRASE[currentState]}`;
  return waitingStepNumber === null || waitingStepNumber === currentStep.number
    ? head
    : `${head}, step ${waitingStepNumber} waits on you`;
};
