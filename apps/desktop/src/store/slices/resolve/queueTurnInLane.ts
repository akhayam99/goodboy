import { listResolveAttempts } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { classifyAgent } from '../../../features/session/agent-kind';
import { tauriDatabase } from '../../../shared/lib/db';
import { attemptLanePathOf, laneHolderOf } from './resolveLane';
import { resumableResolveThreadIds } from './resumableResolveThreadIds';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly content: string;
  readonly threadIds: ReadonlyArray<string> | undefined;
};

export const queueTurnInLane = async ({
  get,
  sessionId,
  agentId,
  content,
  threadIds,
}: Params): Promise<boolean> => {
  const state = get();
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const agent = agents.find((item) => item.id === agentId);
  if (
    agent === undefined ||
    classifyAgent({ agent, override: state.agentKindOverride[agentId] ?? null }) !== 'resolver'
  ) {
    return false;
  }
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId });
  const own = attempts.filter((attempt) => attempt.agentId === agentId);
  const latest = own.at(-1);
  const worktreePath = latest === undefined ? null : attemptLanePathOf({ attempt: latest });
  if (latest === undefined || worktreePath === null) {
    return false;
  }
  const holder = laneHolderOf({ attempts, agents, worktreePath });
  if (holder === null || holder.agentId === agentId) {
    return false;
  }
  const waiting = latest.phase === 'queued' ? latest : null;
  const claimed =
    threadIds ??
    resumableResolveThreadIds({ rows: state.sessionResolveThreads[sessionId] ?? [], agent });
  await get().recordResolveAttempt({
    sessionId,
    agent,
    provider: latest.provider,
    model: latest.model,
    effort: latest.effort,
    instructions: waiting?.instructions == null ? content : `${waiting.instructions}\n\n${content}`,
    phase: 'queued',
    mountTarget: latest.mountTarget,
    threadIds: [...new Set([...(waiting?.threadIds ?? []), ...claimed])],
  });
  return true;
};
