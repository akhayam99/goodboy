import type { WorkflowOrchestrationStop } from '@goodboy/types';

const OPERATOR_STOP_OF_AUTO_RUN = 'operator:auto-run';

type StoredStopParams = {
  readonly stop: WorkflowOrchestrationStop;
};

export const withAutoRunFlag = ({ stop }: StoredStopParams): WorkflowOrchestrationStop =>
  String(stop.kind) === OPERATOR_STOP_OF_AUTO_RUN
    ? { ...stop, kind: 'operator', wasAutoRun: true }
    : stop;

type StopKindParams = {
  readonly stop: WorkflowOrchestrationStop | null;
};

export const stopKindColumnOf = ({ stop }: StopKindParams): string => {
  if (stop === null) {
    return 'failure';
  }
  return stop.kind === 'operator' && stop.wasAutoRun === true
    ? OPERATOR_STOP_OF_AUTO_RUN
    : stop.kind;
};
