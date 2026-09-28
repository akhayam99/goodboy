import type { Agent, SessionId } from '@goodboy/types';
import { readInterruptedRuns, takeInterruptedRuns, type InterruptedRuns } from './restartMarker';
import { resumeAfterRestart } from './resumeAfterRestart';
import type { GetFn } from './types';

type Candidate = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

type CollectParams = {
  readonly get: GetFn;
  readonly marker: InterruptedRuns;
};

const collectCandidates = ({ get, marker }: CollectParams): ReadonlyArray<Candidate> => {
  const state = get();
  const archived = new Set(
    state.sessions.filter((session) => session.archivedAt != null).map((session) => session.id),
  );
  const candidates: Candidate[] = [];
  for (const [sessionId, agents] of Object.entries(state.sessionPhaseRuns)) {
    if (archived.has(sessionId as SessionId)) {
      continue;
    }
    for (const agent of agents) {
      const isInterrupted =
        agent.status === 'stopped' &&
        agent.stoppedBy === 'app' &&
        agent.runId != null &&
        marker.runIds.has(agent.runId);
      if (isInterrupted) {
        candidates.push({ sessionId: sessionId as SessionId, agent });
      }
    }
  }
  return candidates;
};

type Params = {
  readonly get: GetFn;
};

export const resumeInterruptedAgents = async ({ get }: Params): Promise<void> => {
  const marker = await readInterruptedRuns();
  if (marker === null) {
    return;
  }
  const candidates = collectCandidates({ get, marker });
  if (candidates.length === 0) {
    return;
  }
  await takeInterruptedRuns({
    marker,
    runIds: candidates.flatMap(({ agent }) => (agent.runId == null ? [] : [agent.runId])),
  });
  await Promise.all(
    candidates.map(async ({ sessionId, agent }) => {
      try {
        await resumeAfterRestart({
          get,
          sessionId,
          agentId: agent.id,
          reason: marker.reason,
        });
      } catch (error) {
        console.error('resume after restart failed', error);
      }
    }),
  );
};
