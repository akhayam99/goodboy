import type { Agent, IsoDateTime, Session, TurnState } from '@goodboy/types';
import { updateAgentStatus, updateSessionState } from '@goodboy/db';
import { cancelTurn } from '../../../features/chat/turn';
import { tauriDatabase } from '../../../shared/lib/db';

type ReconcileLoadedSessionsParams = Readonly<{
  sessions: ReadonlyArray<Session>;
  liveRunIds: ReadonlySet<string>;
  now: IsoDateTime;
}>;

type ReconcileLoadedAgentParams = Readonly<{
  agent: Agent;
  liveRunIds: ReadonlySet<string>;
}>;

export const reconcileLoadedSessions = async ({
  sessions,
  liveRunIds,
  now,
}: ReconcileLoadedSessionsParams): Promise<ReadonlyArray<Session>> => {
  return Promise.all(
    sessions.map(async (session) => {
      if (session.state.kind !== 'running') {
        return session;
      }
      if (liveRunIds.has(session.state.runId)) {
        await cancelTurn(session.state.runId).catch(() => undefined);
      }
      const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
      await updateSessionState(tauriDatabase, session.id, idleState, now).catch(() => undefined);
      return { ...session, state: idleState, updatedAt: now };
    }),
  );
};

export const reconcileLoadedAgent = async ({
  agent,
  liveRunIds,
}: ReconcileLoadedAgentParams): Promise<Agent> => {
  if (agent.status !== 'running') {
    return agent;
  }
  if (agent.runId != null && liveRunIds.has(agent.runId)) {
    await cancelTurn(agent.runId).catch(() => undefined);
  }
  await updateAgentStatus(tauriDatabase, agent.id, { status: 'pending' }).catch(() => undefined);
  return { ...agent, status: 'pending' };
};
