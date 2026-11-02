import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectActiveMountId } from '../project-mounts/selectors';
import type { MountRequestState, SessionRequestState } from './state';

export type MountRequestProjectionState = Pick<
  AppState,
  | 'sessions'
  | 'sessionProjectMounts'
  | 'sessionMounts'
  | 'sessionActiveMount'
  | 'sessionActiveProject'
  | 'mountRequests'
  | 'sessionRequests'
>;

type ProjectionParams = {
  readonly state: MountRequestProjectionState;
  readonly sessionId: SessionId;
};

type ApplyParams = ProjectionParams & {
  readonly mountId: MountId;
  readonly request: MountRequestState | null;
};

type SessionRequestParams = {
  readonly mount: MountRequestState;
};

export type MountRequestWrite = Pick<AppState, 'mountRequests' | 'sessionRequests'>;

const sessionRequestOf = ({ mount }: SessionRequestParams): SessionRequestState => {
  if (mount.kind === 'gitlab') {
    return {
      kind: 'gitlab',
      mr: mount.mr,
      approvals: mount.approvals ?? null,
      fetchedAt: mount.fetchedAt,
      failedAt: mount.failedAt ?? null,
      loading: mount.loading,
      error: mount.error,
    };
  }
  return {
    kind: 'bitbucket',
    pr: mount.pr,
    fetchedAt: mount.fetchedAt,
    failedAt: mount.failedAt ?? null,
    loading: mount.loading,
    error: mount.error,
  };
};

export const deriveRequestProjection = ({
  state,
  sessionId,
}: ProjectionParams): Pick<AppState, 'sessionRequests'> => {
  const activeMountId = selectActiveMountId({ state, sessionId });
  const active = activeMountId === null ? undefined : (state.mountRequests ?? {})[activeMountId];
  const sessionRequests = { ...state.sessionRequests };
  if (active === undefined) {
    delete sessionRequests[sessionId];
    return { sessionRequests };
  }
  sessionRequests[sessionId] = sessionRequestOf({ mount: active });
  return { sessionRequests };
};

export const applyMountRequest = ({
  state,
  sessionId,
  mountId,
  request,
}: ApplyParams): MountRequestWrite => {
  const mountRequests = { ...state.mountRequests };
  if (request === null) {
    delete mountRequests[mountId];
  }
  if (request !== null) {
    mountRequests[mountId] = request;
  }
  return {
    mountRequests,
    ...deriveRequestProjection({ state: { ...state, mountRequests }, sessionId }),
  };
};
