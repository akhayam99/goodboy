import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Agent,
  AgentId,
  ProviderId,
  Session,
  SessionId,
  TurnState,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
} from '../../../../../store';
import {
  resolveWorkflowAdvance,
  type WorkflowBlockReason,
} from '../../../../../features/workflows/advanceGate';
import { viewWorkflowAdvance } from '../../../../../features/workflows/workflowAdvanceView';
import { WORKFLOW_BLOCK_COPY } from '../../../../../features/workflows/blockCopy';
import { workflowRunHasOpenQuestions } from '../../../../../features/context/openQuestionsGate';
import { classifyAgent, type AgentKind } from '../../../../../features/session/agent-kind';
import { useAgentMetrics } from '../../../../../features/session/hooks/useAgentMetrics';
import { formatError } from '../../../../../shared/lib/errors';
import { useAttachedWorkflowRuns } from '../../../../workflows/useAttachedWorkflowRuns';
import { useSessionAgentTree } from './useSessionAgentTree';
import { workflowKindName } from '../lib';

type Params = {
  readonly task: Session;
  readonly workflowRunId: WorkflowRunId | undefined;
};

export type StartStepAgentParams = {
  readonly agent: Agent;
  readonly model?: string;
  readonly isConfirmed?: boolean;
};

export const useAgentsSection = ({ task, workflowRunId }: Params) => {
  const isTaskActive = useAppStore((s) => s.currentSessionId === task.id);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, AgentKind> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const kind = s.agentKindOverride[run.id];
        if (kind) {
          out[run.id] = kind;
        }
      }
      return out;
    }),
  );
  const agentModelOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, string> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const model = s.agentModelOverride[run.id];
        if (model) {
          out[run.id] = model;
        }
      }
      return out;
    }),
  );
  const agentProviderOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, ProviderId> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const provider = s.agentProviderOverride?.[run.id];
        if (provider) {
          out[run.id] = provider;
        }
      }
      return out;
    }),
  );
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[task.id] ?? null);
  const worktreePath = useAppStore((s) => (s.sessionWorktrees[task.id] ?? [])[0] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const requestOpenQuestionScroll = useAppStore((s) => s.requestOpenQuestionScroll);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const skipStuckStepAndAdvance = useAppStore((s) => s.skipStuckStepAndAdvance);
  const detachWorkflowFromSession = useAppStore((s) => s.detachWorkflowFromSession);
  const renameAgent = useAppStore((s) => s.renameAgent);
  const attachedRuns = useAttachedWorkflowRuns({ session: task });
  const discardWorkflow = useAppStore((s) => s.discardWorkflow);
  const reorderSessionWorkflows = useAppStore((s) => s.reorderSessionWorkflows);
  const setWorkflowRunAutoRun = useAppStore((s) => s.setWorkflowRunAutoRun);
  const startWorkflowRun = useAppStore((s) => s.startWorkflowRun);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const workflowNameByRunId = useMemo(() => {
    const map = new Map<string, string>();
    for (const { run, workflow } of attachedRuns) {
      map.set(run.id, workflowKindName(workflow));
    }
    return map;
  }, [attachedRuns]);
  const openQuestions = useSessionOpenQuestions(task.id);
  const loading = useSessionLoading(task.id);
  const summarizerBusy = useAppStore((s) => s.summarizerStatus[task.id]?.status === 'running');
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<AgentId | null>(null);
  const workflowExpand = useAppStore((s) => s.workflowExpand[task.id]);
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId?.[task.id] ?? null);
  const toggleWorkflowExpand = useAppStore((s) => s.toggleWorkflowExpand);
  const setPanelSectionExpanded = useAppStore((s) => s.setPanelSectionExpanded);
  const workflowExpanded = useAppStore((s) => s.sessionPanelExpanded[task.id]?.workflow ?? true);
  const tree = useSessionAgentTree({ phaseRuns, selectedAgentId, isTaskActive });
  const agentTurnState = useAppStore(
    useShallow((s) => {
      const out: Record<string, TurnState> = {};
      for (const run of phaseRuns) {
        const turn = s.agentTurnState[run.id];
        if (turn === undefined) {
          continue;
        }
        out[run.id] = turn;
      }
      return out;
    }),
  );

  const workflowAdvance = useMemo(() => {
    const actionableStepIdByRunId = new Map<string, string | null>();
    const blockReasonByRunId = new Map<string, WorkflowBlockReason | null>();
    for (const { run, workflow } of attachedRuns) {
      const runAgents = tree.agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
      const view = viewWorkflowAdvance({
        state: resolveWorkflowAdvance({
          workflow,
          agents: runAgents,
          hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, run.id),
          isSummarizerRunning: summarizerBusy,
          isTurnRunning: runAgents.some((agent) => {
            const turn = agentTurnState[agent.id];
            return turn?.kind === 'running' || turn?.kind === 'starting';
          }),
        }),
      });
      actionableStepIdByRunId.set(run.id, run.discardedAt ? null : (view.pendingStep?.id ?? null));
      blockReasonByRunId.set(run.id, view.blockReason);
    }
    return { actionableStepIdByRunId, blockReasonByRunId };
  }, [attachedRuns, tree.agentsByRunId, openQuestions, summarizerBusy, agentTurnState]);
  const { actionableStepIdByRunId, blockReasonByRunId } = workflowAdvance;

  const onDiscardWorkflow = useCallback(
    async (runId: WorkflowRunId) => {
      try {
        await discardWorkflow(task.id, runId);
      } catch (err) {
        setSpawnError(formatError(err));
      }
    },
    [discardWorkflow, task.id],
  );

  const onDeleteWorkflow = useCallback(
    async (runId: WorkflowRunId) => {
      try {
        await detachWorkflowFromSession(task.id, runId);
      } catch (err) {
        setSpawnError(formatError(err));
      }
    },
    [detachWorkflowFromSession, task.id],
  );

  const onReorderWorkflow = useCallback(
    async (runId: WorkflowRunId, direction: 'up' | 'down') => {
      const shown = [...task.workflowRuns].sort((a, b) => b.ordinal - a.ordinal).map((r) => r.id);
      const idx = shown.indexOf(runId);
      if (idx === -1) {
        return;
      }
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= shown.length) {
        return;
      }
      [shown[idx], shown[swap]] = [shown[swap]!, shown[idx]!];
      try {
        await reorderSessionWorkflows(task.id, [...shown].reverse());
      } catch (err) {
        setSpawnError(formatError(err));
      }
    },
    [reorderSessionWorkflows, task.id, task.workflowRuns],
  );

  const standaloneAgentCount = useMemo(
    () =>
      tree.adHocAgents.filter(
        (agent) => classifyAgent(agent, agentKindOverride[agent.id] ?? null) !== 'resolver',
      ).length,
    [tree.adHocAgents, agentKindOverride],
  );
  const agentsExpanded = useAppStore(
    (s) => s.sessionPanelExpanded[task.id]?.agents ?? standaloneAgentCount > 0,
  );

  const metrics = useAgentMetrics({ sessionId: task.id });

  const onPickAgent = (sid: AgentId) => {
    if (sid === selectedAgentId) {
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
      return;
    }
    void selectAgent(task.id, sid);
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  const onResolveFirstForRun = (run: WorkflowRun) => {
    const q = openQuestions.find(
      (oq) => oq.status === 'open' && (!oq.workflowRunId || oq.workflowRunId === run.id),
    );
    if (!q || !q.createdByAgentId) {
      return;
    }
    void selectAgent(task.id, q.createdByAgentId);
    requestOpenQuestionScroll({ agentId: q.createdByAgentId, questionId: q.id });
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  const onStartStepAgent = async ({ agent, model, isConfirmed = false }: StartStepAgentParams) => {
    setSpawnError(null);
    const blockReason =
      agent.workflowRunId != null ? (blockReasonByRunId.get(agent.workflowRunId) ?? null) : null;
    if (agent.status === 'pending' && blockReason != null && !isConfirmed) {
      setSpawnError(WORKFLOW_BLOCK_COPY[blockReason]);
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    try {
      if (agent.status === 'pending') {
        await activateWorkflowAgent({
          sessionId: task.id,
          agentId: agent.id,
          focus: 'agent',
          bypassGate: isConfirmed,
        });
        return;
      }
      await spawnAgent(task.id, {
        ...(agent.stepId != null && { stepId: agent.stepId }),
        ...(agent.workflowRunId != null && { workflowRunId: agent.workflowRunId }),
        ...(model !== undefined && { model }),
        focus: 'agent',
      });
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const onStartWorkflowRun = async (sessionId: SessionId, workflowRunId: WorkflowRunId) => {
    await startWorkflowRun(sessionId, workflowRunId);
    setActiveLens(sessionId, 'workflows');
  };

  const onRenameCommit = async (id: AgentId, name: string) => {
    setEditingId(null);
    try {
      await renameAgent(task.id, id, name);
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const visibleWorkflowRuns =
    workflowRunId == null
      ? attachedRuns
      : attachedRuns.filter(({ run }) => run.id === workflowRunId);

  return {
    actionableStepIdByRunId,
    agentKindOverride,
    agentModelOverride,
    agentProviderOverride,
    agentsByRunId: tree.agentsByRunId,
    agentsExpanded,
    attachedRuns,
    blockReasonByRunId,
    childrenByParentId: tree.childrenByParentId,
    clusterExpand: tree.clusterExpand,
    countUnread: tree.countUnread,
    editingId,
    focusedWorkflowRunId,
    skipStuckStepAndAdvance,
    hasAnyWorkflow: attachedRuns.length > 0,
    isTaskActive,
    isTranscriptLoading: loading.transcript,
    metrics,
    onDiscardWorkflow,
    onDeleteWorkflow,
    onPickAgent,
    onRenameCommit,
    onReorderWorkflow,
    onResolveFirstForRun,
    onStartStepAgent,
    selectedAgentId,
    setEditingId,
    setPanelSectionExpanded,
    setWorkflowRunAutoRun,
    spawnError,
    standaloneAgentCount,
    startWorkflowRun: onStartWorkflowRun,
    toggleClusterExpand: tree.toggleClusterExpand,
    toggleWorkflowExpand,
    visibleWorkflowRuns,
    workflowExpand,
    workflowExpanded,
    workflowNameByRunId,
    worktreePath,
  };
};
