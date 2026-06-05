import type {
  Agent,
  AgentId,
  ImplementationCluster,
  IsoDateTime,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { extractClusterDone } from '@goodboy/core';
import {
  invokeAgentInsert,
  invokeAgentList,
  invokeAgentUpdateStatus,
} from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

const MAX_CONTINUE = 2;

const continueAttempts = new Map<string, number>();

const nowIso = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

function childrenOf(runs: ReadonlyArray<Agent>, containerId: AgentId): ReadonlyArray<Agent> {
  return runs.filter((r) => r.parentAgentId === containerId).sort((a, b) => a.ordinal - b.ordinal);
}

function composeClusterKickoff(
  childId: AgentId,
  goalTitle: string,
  clusters: ReadonlyArray<ImplementationCluster>,
  index: number,
): string {
  const cluster = clusters[index];
  const priorTitles = clusters.slice(0, index).map((c, i) => `${i + 1}. ${c.title}`);
  const priorBlock =
    priorTitles.length > 0
      ? `Already completed (their changes are on disk, read files as needed):\n${priorTitles.join('\n')}`
      : 'This is the first cluster.';
  return [
    'You are executing ONE cluster of a larger implementation plan, in sequence.',
    `Overall goal: ${goalTitle}`,
    priorBlock,
    '',
    `Your cluster (${index + 1}/${clusters.length}): ${cluster?.title ?? ''}`,
    '',
    cluster?.instructions ?? '',
    '',
    'Execute ONLY this cluster. Do not start later clusters. When every item in this cluster is fully complete, emit on its own line exactly:',
    `<<cluster-done id="${childId}">>`,
    'Do not emit that marker until the cluster is truly done.',
  ].join('\n');
}

function composeContinuePrompt(
  childId: AgentId,
  cluster: ImplementationCluster | undefined,
): string {
  return [
    `You stopped before finishing this cluster${cluster ? ` (${cluster.title})` : ''}.`,
    'Continue with the remaining items now. When every item is complete, emit on its own line exactly:',
    `<<cluster-done id="${childId}">>`,
  ].join('\n');
}

function activateChild(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  childId: AgentId,
  content: string,
): void {
  set((s) => ({
    selectedAgentId: { ...s.selectedAgentId, [sessionId]: childId },
    agentTurnState: {
      ...s.agentTurnState,
      [childId]: { kind: 'idle' as const, lastActivityAt: nowIso() },
    },
  }));
  void get().sendTurn({ sessionId, agentId: childId, content });
}

export async function fanOutClusters(
  set: SetFn,
  get: GetFn,
  sessionId: SessionId,
  container: Agent,
  clusters: ReadonlyArray<ImplementationCluster>,
  goalTitle: string,
): Promise<void> {
  await invokeAgentUpdateStatus(container.id, { status: 'running' });

  const baseOrdinal =
    (get().sessionPhaseRuns[sessionId] ?? []).reduce((m, r) => Math.max(m, r.ordinal), -1) + 1;
  const childIds: AgentId[] = [];
  for (let i = 0; i < clusters.length; i++) {
    const inserted = await invokeAgentInsert({
      sessionId,
      parentAgentId: container.id,
      ...(container.workflowRunId != null && { workflowRunId: container.workflowRunId }),
      ordinal: baseOrdinal + i,
      name: clusters[i]!.title,
      status: 'pending',
      kind: 'implementer',
    });
    childIds.push(inserted.id);
  }

  const refreshed = await invokeAgentList(sessionId);
  set((s) => {
    const transcripts = { ...s.transcripts };
    const agentTurnState = { ...s.agentTurnState };
    const agentKindOverride = { ...s.agentKindOverride };
    for (const id of childIds) {
      transcripts[id] = transcripts[id] ?? [];
      agentTurnState[id] = { kind: 'idle', lastActivityAt: nowIso() };
      agentKindOverride[id] = 'implementer';
    }
    return {
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
      transcripts,
      agentTurnState,
      agentKindOverride,
    };
  });

  const first = childIds[0];
  if (first) {
    activateChild(set, get, sessionId, first, composeClusterKickoff(first, goalTitle, clusters, 0));
  }
}

function findClustersPlan(
  get: GetFn,
  sessionId: SessionId,
  workflowRunId: WorkflowRunId | undefined,
) {
  const plans = get().sessionPlans[sessionId] ?? [];
  for (let i = plans.length - 1; i >= 0; i--) {
    const p = plans[i];
    if (!p?.clusters || p.clusters.length < 2) continue;
    if (p.workflowRunId !== workflowRunId) continue;
    return p;
  }
  return null;
}

export function advanceClusterImplementation(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, childAgentId: AgentId, assistantText: string) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const child = runs.find((r) => r.id === childAgentId);
    if (!child || !child.parentAgentId) return;
    const containerId = child.parentAgentId;
    const plan = findClustersPlan(get, sessionId, child.workflowRunId);
    const clusters = plan?.clusters ?? [];
    const goalTitle = plan?.title ?? 'the plan';
    const index = Math.max(
      0,
      childrenOf(runs, containerId).findIndex((c) => c.id === childAgentId),
    );

    if (!extractClusterDone(assistantText)) {
      const attempts = continueAttempts.get(childAgentId) ?? 0;
      if (attempts < MAX_CONTINUE) {
        continueAttempts.set(childAgentId, attempts + 1);
        activateChild(
          set,
          get,
          sessionId,
          childAgentId,
          composeContinuePrompt(childAgentId, clusters[index]),
        );
      } else {
        continueAttempts.delete(childAgentId);
        await invokeAgentUpdateStatus(childAgentId, { status: 'failed', completedAt: nowIso() });
        const stalled = await invokeAgentList(sessionId);
        set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: stalled } }));
        void get().emitNotification(
          'error',
          'warning',
          `cluster stalled: ${child.name}`,
          'the implementer stopped before completing this cluster. open the agent and continue manually.',
          { sessionId },
        );
      }
      return;
    }

    continueAttempts.delete(childAgentId);
    await invokeAgentUpdateStatus(childAgentId, {
      status: 'completed',
      outputSummary: assistantText.slice(0, 2000),
      completedAt: nowIso(),
    });
    let refreshed = await invokeAgentList(sessionId);
    set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));

    const children = childrenOf(refreshed, containerId);
    const completedCount = children.filter((c) => c.status === 'completed').length;
    const total = clusters.length > 0 ? clusters.length : children.length;

    if (completedCount >= total) {
      await invokeAgentUpdateStatus(containerId, {
        status: 'completed',
        outputSummary: `completed ${completedCount} clusters`,
        completedAt: nowIso(),
      });
      refreshed = await invokeAgentList(sessionId);
      set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed } }));
      void get().refreshUnreadWorkspaces();
      void get().maybeAutoAdvanceWorkflow(sessionId);
      return;
    }

    const next = children[completedCount];
    if (next) {
      activateChild(
        set,
        get,
        sessionId,
        next.id,
        composeClusterKickoff(next.id, goalTitle, clusters, completedCount),
      );
    }
  };
}
