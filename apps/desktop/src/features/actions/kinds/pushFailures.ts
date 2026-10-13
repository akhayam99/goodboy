import type { PushFailedError } from './pushFailedError';

export const pushFailures = new WeakMap<Error, PushFailedError>();
