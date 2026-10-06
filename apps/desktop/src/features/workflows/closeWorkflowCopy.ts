import { NAMES } from '../../shared/names';

export const CLOSE_WORKFLOW_COPY = {
  label: NAMES.stopRun,
  hint: 'End this run and keep what it wrote',
  title: 'Stop this run?',
  description:
    'Steps that have not run are skipped and the one in flight stops. Everything already written stays. Add a step to pick the run up again.',
} as const satisfies Record<string, string>;
