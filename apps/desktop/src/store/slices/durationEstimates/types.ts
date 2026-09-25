import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { DurationEstimatesState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type LoadWorkspaceDurationHistoryParams = {
  readonly workspaceId: WorkspaceId;
};

export type LoadSessionTurnSpansParams = {
  readonly sessionId: SessionId;
};

export type RefreshTurnSpansParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export type DurationEstimatesSlice = DurationEstimatesState & {
  loadWorkspaceDurationHistory(params: LoadWorkspaceDurationHistoryParams): Promise<void>;
  loadSessionTurnSpans(params: LoadSessionTurnSpansParams): Promise<void>;
  refreshTurnSpans(params: RefreshTurnSpansParams): Promise<void>;
};
