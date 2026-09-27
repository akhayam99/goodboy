import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import {
  detachWorkflowFromSession as detachWorkflowFromSessionInDb,
  updateSessionState,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { awaitRunStopped } from '../../awaitRunStopped';
import { cancelledRunIds, deriveSessionState, purgedAgentIds } from '../../session-mutators';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import { cancelTurnStartWindow } from '../turn/turnStartWindow';
import type { GetFn, SetFn } from './types';

type OwnedAgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflowRunId: WorkflowRunId;
};

const runOwnedAgentIds = ({ agents, workflowRunId }: OwnedAgentsParams): ReadonlySet<AgentId> => {
  const owned = new Set<AgentId>(
    agents.filter((agent) => agent.workflowRunId === workflowRunId).map((agent) => agent.id),
  );
  let hasGrown = true;
  while (hasGrown) {
    hasGrown = false;
    for (const agent of agents) {
      if (owned.has(agent.id) || agent.parentAgentId == null || !owned.has(agent.parentAgentId)) {
        continue;
      }
      owned.add(agent.id);
      hasGrown = true;
    }
  }
  return owned;
};

type OmitAgentsParams<T> = {
  readonly record: Readonly<Record<string, T>> | undefined;
  readonly ids: ReadonlySet<string>;
};

const omitAgents = <T>({ record, ids }: OmitAgentsParams<T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record ?? {}).filter(([id]) => !ids.has(id)));

export const detachWorkflowFromSession = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const run = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (!run) {
      return;
    }

    const ownedIds = runOwnedAgentIds({
      agents: state.sessionPhaseRuns[sessionId] ?? [],
      workflowRunId,
    });
    const stopping: Array<Promise<boolean>> = [];
    for (const agentId of ownedIds) {
      const turn = state.agentTurnState[agentId];
      if (turn?.kind === 'starting') {
        cancelTurnStartWindow({ agentId });
        continue;
      }
      if (turn?.kind !== 'running') {
        continue;
      }
      cancelledRunIds.add(turn.runId);
      await cancelTurn(turn.runId).catch(() => undefined);
      stopping.push(awaitRunStopped({ runId: turn.runId }).catch(() => false));
    }
    const isEveryRunStopped = (await Promise.all(stopping)).every((stopped) => stopped);

    for (const agentId of ownedIds) {
      purgedAgentIds.add(agentId);
    }
    const now = new Date().toISOString() as IsoDateTime;
    try {
      await detachWorkflowFromSessionInDb(tauriDatabase, sessionId, workflowRunId, now);
    } catch (error) {
      for (const agentId of ownedIds) {
        purgedAgentIds.delete(agentId);
      }
      throw error;
    }

    const refreshed = await invokeAgentList(sessionId);
    dropPendingTurnEvents({ agentIds: [...ownedIds] });
    const remaining = session.workflowRuns.filter((r) => r.id !== workflowRunId);
    const stillUsesTemplate = remaining.some((r) => r.workflowId === run.workflowId);
    let derived: ReturnType<typeof deriveSessionState> | null = null;

    set((s) => {
      const nextTurnState = omitAgents({ record: s.agentTurnState, ids: ownedIds });
      const survivorStates = refreshed
        .map((agent) => nextTurnState[agent.id])
        .filter((turn): turn is NonNullable<typeof turn> => turn !== undefined);
      derived = deriveSessionState(survivorStates, now);
      const selected = s.selectedAgentId[sessionId];
      const isSelectedDeleted = selected != null && ownedIds.has(selected);
      return {
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
        selectedAgentId: isSelectedDeleted
          ? omitAgents({ record: s.selectedAgentId, ids: new Set([sessionId]) })
          : s.selectedAgentId,
        agentTurnState: nextTurnState,
        transcripts: omitAgents({ record: s.transcripts, ids: ownedIds }),
        agentDraft: omitAgents({ record: s.agentDraft, ids: ownedIds }),
        agentAttachments: omitAgents({ record: s.agentAttachments, ids: ownedIds }),
        agentQueue: omitAgents({ record: s.agentQueue, ids: ownedIds }),
        agentRunHistory: omitAgents({ record: s.agentRunHistory, ids: ownedIds }),
        runRouting: omitAgents({ record: s.runRouting, ids: ownedIds }),
        agentModelOverride: omitAgents({ record: s.agentModelOverride, ids: ownedIds }),
        agentProviderOverride: omitAgents({ record: s.agentProviderOverride, ids: ownedIds }),
        agentEffortOverride: omitAgents({ record: s.agentEffortOverride, ids: ownedIds }),
        agentKindOverride: omitAgents({ record: s.agentKindOverride, ids: ownedIds }),
        agentTurnDestination: omitAgents({ record: s.agentTurnDestination, ids: ownedIds }),
        workflowContinueAttempts: omitAgents({ record: s.workflowContinueAttempts, ids: ownedIds }),
        clusterStepStartAttempts: omitAgents({ record: s.clusterStepStartAttempts, ids: ownedIds }),
        decisionRestartMarks: omitAgents({
          record: s.decisionRestartMarks,
          ids: new Set([workflowRunId]),
        }),
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId
            ? { ...sess, workflowRuns: remaining, state: derived!, updatedAt: now }
            : sess,
        ),
        sessionWorkflows: {
          ...s.sessionWorkflows,
          [sessionId]: stillUsesTemplate
            ? (s.sessionWorkflows[sessionId] ?? [])
            : (s.sessionWorkflows[sessionId] ?? []).filter((w) => w.id !== run.workflowId),
        },
      };
    });
    if (derived !== null) {
      await updateSessionState(tauriDatabase, sessionId, derived, now).catch(() => undefined);
    }
    if (!isEveryRunStopped) {
      void get()
        .emitNotification({
          kind: 'error',
          severity: 'warning',
          title: 'Deleted workflow agent is still running',
          body: 'The workflow is gone, but a provider process did not stop. Anything it writes from here is discarded. Quit it yourself if it keeps holding the worktree.',
          sessionId,
          workspaceId: session.workspaceId,
        })
        .catch(() => undefined);
    }
  };
};
