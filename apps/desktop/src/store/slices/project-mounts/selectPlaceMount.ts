import type { SessionId, SessionProjectMount } from '@goodboy/types';
import type { AppState } from '../../types';
import { runGroupFocusOf } from '../navigation/runGroupFocusOf';
import { selectDisplayedMount, selectWritableMounts } from './selectors';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

type PathParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly path: string | null;
};

const mountAtPath = ({ mounts, path }: PathParams): SessionProjectMount | null =>
  path === null || path === ''
    ? null
    : (mounts.find((mount) => mount.worktreePath === path) ?? null);

export const selectPlaceMount = ({ state, sessionId }: Params): SessionProjectMount | null => {
  if (state.currentSessionId !== sessionId) {
    return null;
  }
  const lens = state.activeLens[sessionId] ?? null;
  if (lens === 'branch' || lens === 'files') {
    return selectDisplayedMount({ state, sessionId });
  }
  const mounts = selectWritableMounts({ state, sessionId });
  const agentId = state.selectedAgentId[sessionId] ?? null;
  const agentMountId =
    agentId === null
      ? undefined
      : (state.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === agentId)?.mountId;
  const agentMount =
    agentMountId === undefined
      ? null
      : (mounts.find((mount) => mount.mountId === agentMountId) ?? null);
  if (agentMount !== null) {
    return agentMount;
  }
  return mountAtPath({ mounts, path: runGroupFocusOf({ state })?.mountPath ?? null });
};
