import { listResolveAttempts, listResolveCandidates } from '@goodboy/db';
import type { AgentId, MountTargetSnapshot, SessionId } from '@goodboy/types';
import { carriesWorkingTree } from '../../../features/resolve/notes/carriesWorkingTree';
import { LANE_READY_FIX_FIRST } from '../../../features/resolve/laneCopy';
import { classifyAgent } from '../../../features/session/agent-kind';
import { prepareResolveCopy } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectMountById } from '../project-mounts/selectors';
import { readWorktreeStatusNow } from '../../runtime/worktreeStatuses/cache';
import { laneTipOf, readyFixBlocking } from './resolveLane';
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
  readonly base: string | null;
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
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId });
  const latest = attempts.filter((attempt) => attempt.agentId === agentId).at(-1);
  if (latest === undefined || latest.batchId === null) {
    return null;
  }
  const candidates = (await listResolveCandidates({ db: tauriDatabase, sessionId })).map(
    (candidate) => ({ candidate }),
  );
  const threadIds = latest.threadIds;
  const isNote = carriesWorkingTree({ threadIds });
  if (
    latest.copyPath !== null &&
    (await readWorktreeStatusNow({ worktreePath: latest.copyPath, baseBranch: null })) !== null
  ) {
    const own = candidates.find(({ candidate }) => candidate.id === latest.id)?.candidate;
    if (isNote && own?.state === 'ready') {
      throw new Error(LANE_READY_FIX_FIRST);
    }
    const base = isNote ? (own?.baseSha ?? null) : null;
    return { copyPath: latest.copyPath, mountTarget: latest.mountTarget, base };
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
  if (readyFixBlocking({ candidates, attempts, worktreePath, threadIds }) !== null) {
    throw new Error(LANE_READY_FIX_FIRST);
  }
  const startSha = laneTipOf({ candidates, worktreePath });
  const copy = await prepareResolveCopy({
    worktreePath,
    attemptId: latest.id,
    ...(startSha !== null && { startSha }),
    shouldCarryWorkingTree: isNote,
  });
  return { copyPath: copy.copyPath, mountTarget: latest.mountTarget, base: copy.base };
};
