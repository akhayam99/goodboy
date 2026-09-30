import { recheckSessionMounts } from './recheckSessionMounts';
import { resyncSession } from './resyncSession';
import { sessionSyncInitialState } from './state';
import type { SessionSyncSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createSessionSyncSlice = ({ set, get }: SliceDeps): SessionSyncSlice => ({
  ...sessionSyncInitialState,
  recheckSessionMounts: recheckSessionMounts(get),
  resyncSession: resyncSession(set, get),
});
