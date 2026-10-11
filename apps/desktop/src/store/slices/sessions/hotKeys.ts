import type { SessionsState } from './state';

export const SESSIONS_HOT_KEYS: ReadonlyArray<keyof SessionsState> = [
  'sessionTelemetry',
  'sessionExternalTasks',
];
