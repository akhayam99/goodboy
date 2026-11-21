import type { CheckLogsMap } from './types';

export type ChecksLogState = {
  readonly checkLogs: CheckLogsMap;
};

export const checksLogInitialState: ChecksLogState = {
  checkLogs: {},
};
