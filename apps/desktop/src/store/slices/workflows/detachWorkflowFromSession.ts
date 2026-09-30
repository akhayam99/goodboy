import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import {
  detachWorkflowFromSession as detachWorkflowFromSessionInDb,
  updateSessionState,
} from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { deriveSessionState, purgedAgentIds } from '../sessions/sessionMutators';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import { stopAgentForDelete } from '../agents/stopAgentForDelete';
import { releaseAgentFiles } from '../agents/releaseAgentFiles';
import { omitDeletedAgents } from '../agents/omitDeletedAgents';
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
    const stopped = await Promise.all(
      [...ownedIds].map(async (agentId) => ({
        agentId,
        isRunStopped: await stopAgentForDelete({ get, agentId }),
      })),
    );
    const isEveryRunStopped = stopped.every(({ isRunStopped }) => isRunStopped);
    for (const { agentId, isRunStopped } of stopped) {
      await releaseAgentFiles({ get, sessionId, agentId, isRunStopped });
    }

    for (const agentId of ownedIds) {
      purgedAgentIds.add(agentId);
    }
    const now = new Date().toISOString() as IsoDateTime;
    let removedQuestions: ReadonlyArray<string> = [];
    try {
      removedQuestions = await detachWorkflowFromSessionInDb(
        tauriDatabase,
        sessionId,
        workflowRunId,
        now,
      );
    } catch (error) {
      for (const agentId of ownedIds) {
        purgedAgentIds.delete(agentId);
      }
      throw error;
    }
    if (removedQuestions.length > 0) {
      const slotChanged = await removeQuestionsFromSlot(
        tauriDatabase,
        sessionId,
        removedQuestions,
      ).catch(() => false);
      if (slotChanged) {
        await get().loadSessionSlots(sessionId);
      }
    }
    await get().loadSessionOpenQuestions(sessionId);

    const refreshed = await invokeAgentList(sessionId);
    dropPendingTurnEvents({ agentIds: [...ownedIds] });
    const remaining = session.workflowRuns.filter((r) => r.id !== workflowRunId);
    const stillUsesTemplate = remaining.some((r) => r.workflowId === run.workflowId);
    let derived: ReturnType<typeof deriveSessionState> | null = null;

    set((s) => {
      const cleared = omitDeletedAgents({ state: s, sessionId, agentIds: ownedIds });
      const survivorStates = refreshed
        .map((agent) => cleared.agentTurnState[agent.id])
        .filter((turn): turn is NonNullable<typeof turn> => turn !== undefined);
      derived = deriveSessionState(survivorStates, now);
      return {
        ...cleared,
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
        decisionRestartMarks: Object.fromEntries(
          Object.entries(s.decisionRestartMarks ?? {}).filter(([runId]) => runId !== workflowRunId),
        ),
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
