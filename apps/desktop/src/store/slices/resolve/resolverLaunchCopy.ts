import { listResolveAttempts } from '@goodboy/db';
import type { AgentId, MountTargetSnapshot, SessionId } from '@goodboy/types';
import { classifyAgent } from '../../../features/session/agent-kind';
import { prepareResolveCopy, worktreeStatus } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectMountById } from '../project-mounts/selectors';
import { resolveWorktreePath } from './resolveWorktreePath';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export type ResolverLaunchCopy = {
  readonly copyPath: string;
  readonly mountTarget: MountTargetSnapshot | null;
};

export const resolverLaunchCopy = async ({
  get,
  sessionId,
  agentId,
}: Params): Promise<ResolverLaunchCopy | null> => {
  const state = get();
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((item) => item.id === agentId);
  if (
    agent === undefined ||
    classifyAgent({ agent, override: state.agentKindOverride[agentId] ?? null }) !== 'resolver'
  ) {
    return null;
  }
  const latest = (await listResolveAttempts({ db: tauriDatabase, sessionId }))
    .filter((attempt) => attempt.agentId === agentId)
    .at(-1);
  if (latest === undefined || latest.batchId === null) {
    return null;
  }
  if (
    latest.copyPath !== null &&
    (await worktreeStatus({ worktreePath: latest.copyPath }).catch(() => null)) !== null
  ) {
    return { copyPath: latest.copyPath, mountTarget: latest.mountTarget };
  }
  const mount =
    latest.mountTarget === null
      ? null
      : selectMountById({ state, sessionId, mountId: latest.mountTarget.mountId });
  const worktreePath =
    mount?.worktreePath ??
    (await resolveWorktreePath({ get, sessionId, target: latest.mountTarget }));
  if (worktreePath === null) {
    return null;
  }
  const copy = await prepareResolveCopy({ worktreePath, attemptId: latest.id });
  return { copyPath: copy.copyPath, mountTarget: latest.mountTarget };
};
