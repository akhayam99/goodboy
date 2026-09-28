import type { SessionId } from '@goodboy/types';
import type { SessionSyncState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type RecheckReason = 'turn-end' | 'focus';

export type RecheckSessionMountsParams = {
  readonly sessionId: SessionId;
  readonly reason: RecheckReason;
};

export type ResyncSessionParams = {
  readonly sessionId: SessionId;
};

export type SessionSyncSlice = SessionSyncState & {
  recheckSessionMounts(params: RecheckSessionMountsParams): Promise<void>;
  resyncSession(params: ResyncSessionParams): Promise<void>;
};
