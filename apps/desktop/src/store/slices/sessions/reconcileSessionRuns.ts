import type { Agent, IsoDateTime, ProviderRunId, Session, TurnState } from '@goodboy/types';
import {
  findUndecidedPermissionAsk,
  isTurnAdmissionHeld,
  stopGhostAgent,
  stopGhostAgents,
  updateSessionState,
} from '@goodboy/db';
import { cancelTurn, isTurnStreamActive } from '../../../features/chat/turn';
import {
  listTurnCursorRunIds,
  readTurnCursor,
  type TurnCursor,
  type TurnOwner,
} from '../../../features/chat/turnCursor';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { readLaunchId } from '../../../shared/lib/readLaunchId';

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

export type ReconciledAgent = Readonly<{
  agent: Agent;
  waiting: TurnState | null;
}>;

type WaitingParams = Readonly<{
  agent: Agent;
  runId: ProviderRunId;
}>;

const waitingPermissionOf = async ({ agent, runId }: WaitingParams): Promise<TurnState | null> => {
  const ask = await findUndecidedPermissionAsk({
    db: tauriDatabase,
    agentId: agent.id,
    runId,
  }).catch((error: unknown) => {
    console.error('read the waiting permission failed', error);
    return null;
  });
  return ask === null ? null : { kind: 'blocked', runId: ask.runId, blockedAt: ask.at };
};

export const reconcileLoadedAgent = async ({
  agent,
  liveRunIds,
}: ReconcileLoadedAgentParams): Promise<ReconciledAgent> => {
  if (agent.status !== 'running') {
    return { agent, waiting: null };
  }
  const isOwnedHere =
    agent.runId != null &&
    (isTurnStreamActive({ runId: agent.runId }) || reattachableTurn({ agent }) !== null);
  if (isOwnedHere) {
    return { agent, waiting: null };
  }
  const launchId = await readLaunchId();
  const admission = { db: tauriDatabase, agentId: agent.id, runId: agent.runId ?? null, launchId };
  const isHeld = await isTurnAdmissionHeld({ ...admission, nowMs: Date.now() }).catch(
    (error: unknown) => {
      console.error('read the turn admission failed', error);
      return true;
    },
  );
  if (isHeld) {
    return { agent, waiting: null };
  }
  if (agent.runId != null && liveRunIds.has(agent.runId)) {
    await cancelTurn(agent.runId).catch(() => undefined);
  }
  const waiting =
    agent.runId == null ? null : await waitingPermissionOf({ agent, runId: agent.runId });
  if (waiting !== null) {
    return { agent, waiting };
  }
  const nowMs = Date.now();
  const isStopped = await stopGhostAgent({ ...admission, nowMs }).catch((error: unknown) => {
    console.error('stop the agent left running failed', error);
    return false;
  });
  if (!isStopped) {
    return { agent, waiting: null };
  }
  const stoppedAt = new Date(nowMs).toISOString() as IsoDateTime;
  return { agent: { ...agent, status: 'stopped', stoppedAt, stoppedBy: 'app' }, waiting: null };
};

export const readBackendRunIds = async (): Promise<ReadonlyArray<string> | null> => {
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
    launchId: await readLaunchId(),
    nowMs: Date.now(),
  });
};
