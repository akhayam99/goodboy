import { NAMES } from '../../shared/utils/names';

export const CLOSE_WORKFLOW_COPY = {
  label: NAMES.stopRun,
  hint: 'End this run and keep what it wrote',
  stopped: 'Run stopped',
  partlyStopped: 'Some steps stopped',
} as const satisfies Record<string, string>;
