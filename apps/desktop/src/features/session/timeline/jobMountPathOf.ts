import type { AgentId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type JobMountPath = {
  readonly mountPath: string | null;
  readonly isRebase: boolean;
};

const pathOfMount = ({
  state,
  sessionId,
  mountId,
}: {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: string | null;
}): string | null =>
  mountId === null
    ? null
    : (state.sessionProjectMounts[sessionId]?.find((mount) => mount.mountId === mountId)
        ?.worktreePath ?? null);

export const jobMountPathOf = ({ state, sessionId, agentId }: Params): JobMountPath => {
  const run = Object.values(state.historyRuns).find(
    (candidate) => candidate.sessionId === sessionId && candidate.agentId === agentId,
  );
  if (run !== undefined) {
    return {
      mountPath: pathOfMount({ state, sessionId, mountId: run.mountId }),
      isRebase: run.origin === 'rebase',
    };
  }
  const key = state.scribeAgents[agentId];
  const work = key === undefined ? undefined : state.scribeWork[key];
  if (work !== undefined) {
    return {
      mountPath: pathOfMount({ state, sessionId, mountId: work.mountId }),
      isRebase: false,
    };
  }
  const event = (state.sessionEvents?.[sessionId] ?? []).find(
    (candidate) => candidate.payload?.agentId === agentId,
  );
  return {
    mountPath: event?.payload?.worktreePath ?? null,
    isRebase: event?.payload?.origin === 'rebase',
  };
};
