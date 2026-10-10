import type { Agent, IsoDateTime, ProviderRunId, Session, TurnState } from '@goodboy/types';
import { recordAgentStatus, stopGhostAgents, updateSessionState } from '@goodboy/db';
import { cancelTurn, isTurnStreamActive } from '../../../features/chat/turn';
import {
  listTurnCursorRunIds,
  readTurnCursor,
  type TurnCursor,
  type TurnOwner,
} from '../../../features/chat/turnCursor';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
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

export type ReattachableTurn = {
  readonly runId: ProviderRunId;
  readonly cursor: TurnCursor & { readonly owner: TurnOwner };
};

const isKeptRun = ({ runId }: { readonly runId: ProviderRunId }): boolean =>
  isTurnStreamActive({ runId }) || readTurnCursor({ runId }) !== null;

export const reattachableTurn = ({ agent }: { readonly agent: Agent }): ReattachableTurn | null => {
  const runId = agent.runId;
  if (agent.status !== 'running' || runId == null || isTurnStreamActive({ runId })) {
    return null;
  }
  const cursor = readTurnCursor({ runId });
  if (cursor === null || cursor.owner === null || cursor.owner.agentId !== agent.id) {
    return null;
  }
  return { runId, cursor: { ...cursor, owner: cursor.owner } };
};

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
      if (isKeptRun({ runId: session.state.runId })) {
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
  const isOwnedHere =
    agent.runId != null &&
    (isTurnStreamActive({ runId: agent.runId }) || reattachableTurn({ agent }) !== null);
  if (isOwnedHere) {
    return agent;
  }
  if (agent.runId != null && liveRunIds.has(agent.runId)) {
    await cancelTurn(agent.runId).catch(() => undefined);
  }
  const stoppedAt = new Date().toISOString() as IsoDateTime;
  await recordAgentStatus(tauriDatabase, agent.id, {
    status: 'stopped',
    stoppedAt,
    stoppedBy: 'app',
  }).catch(() => undefined);
  return { ...agent, status: 'stopped', stoppedAt, stoppedBy: 'app' };
};

const readBackendRunIds = async (): Promise<ReadonlyArray<string> | null> => {
  try {
    return (await invokeCommand<string[]>('turn_list_live')) ?? [];
  } catch {
    return null;
  }
};

export const reconcileGhostAgents = async (): Promise<number> => {
  const liveRunIds = await readBackendRunIds();
  if (liveRunIds === null) {
    return 0;
  }
  return stopGhostAgents({
    db: tauriDatabase,
    keepRunIds: [...liveRunIds, ...listTurnCursorRunIds()],
  });
};
