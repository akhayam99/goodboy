import type { Agent, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { claimInterruptedRuns, readInterruptedRuns, type InterruptedRuns } from './restartMarker';
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
  const claimed = await claimInterruptedRuns({
    runIds: candidates.flatMap(({ agent }) => (agent.runId == null ? [] : [agent.runId])),
  });
  const owned = candidates.filter(({ agent }) => agent.runId != null && claimed.has(agent.runId));
  await Promise.all(
    owned.map(async ({ sessionId, agent }) => {
      const failure = await resumeAfterRestart({
        get,
        sessionId,
        agentId: agent.id,
        reason: marker.reason,
      }).then(
        (result) => (result === 'unresumable' ? '' : null),
        (error: unknown) => formatError(error),
      );
      if (failure === null) {
        return;
      }
      await get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: `Couldn't resume ${agent.name} after the restart`,
        body:
          failure === ''
            ? 'It stays stopped. Continue picks up where it was cut.'
            : `It stays stopped: ${failure}. Continue picks up where it was cut.`,
        sessionId,
        coalesceKey: `resume-failed:${agent.id}`,
        action: { kind: 'continue-agent', sessionId, agentId: agent.id },
      });
    }),
  );
};
