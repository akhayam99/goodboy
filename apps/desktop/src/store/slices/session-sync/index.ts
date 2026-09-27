import { recheckSessionMounts } from './recheckSessionMounts';
import { resyncSession } from './resyncSession';
import { sessionSyncInitialState } from './state';
import type { GetFn, SessionSyncSlice, SetFn } from './types';

export const createSessionSyncSlice = (set: SetFn, get: GetFn): SessionSyncSlice => ({
  ...sessionSyncInitialState,
  recheckSessionMounts: recheckSessionMounts(get),
  resyncSession: resyncSession(set, get),
});
