import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, Session, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
} from '../../../../../store';
import { pickNextWorkflowStep } from '../../../../../features/workflows/components/WorkflowNextStepCta';
import {
  resolveWorkflowAdvance,
  type WorkflowBlockReason,
} from '../../../../../features/workflows/advanceGate';
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
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[task.id] ?? null);
  const worktreePath = useAppStore((s) => (s.sessionWorktrees[task.id] ?? [])[0] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const requestOpenQuestionScroll = useAppStore((s) => s.requestOpenQuestionScroll);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const forceAdvanceWorkflowStep = useAppStore((s) => s.forceAdvanceWorkflowStep);
  const renameAgent = useAppStore((s) => s.renameAgent);
  const attachedRuns = useAttachedWorkflowRuns({ session: task });
  const discardWorkflow = useAppStore((s) => s.discardWorkflow);
  const reorderSessionWorkflows = useAppStore((s) => s.reorderSessionWorkflows);
  const setWorkflowRunAutoRun = useAppStore((s) => s.setWorkflowRunAutoRun);
  const startWorkflowRun = useAppStore((s) => s.startWorkflowRun);
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

  const actionableStepIdByRunId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const { run, workflow } of attachedRuns) {
      if (run.discardedAt) {
        map.set(run.id, null);
        continue;
      }
      const runAgents = tree.agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
      map.set(run.id, pickNextWorkflowStep(workflow, runAgents)?.id ?? null);
    }
    return map;
  }, [attachedRuns, tree.agentsByRunId]);
  const blockReasonByRunId = useMemo(() => {
    const map = new Map<string, WorkflowBlockReason | null>();
    for (const { run, workflow } of attachedRuns) {
      const state = resolveWorkflowAdvance({
        workflow,
        agents: tree.agentsByRunId.get(run.id) ?? EMPTY_ARRAY,
        hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, run.id),
        isSummarizerRunning: summarizerBusy,
        isTurnRunning: false,
      });
      map.set(run.id, state.kind === 'blocked' ? state.reason : null);
    }
    return map;
  }, [attachedRuns, tree.agentsByRunId, openQuestions, summarizerBusy]);

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

  const onReorderWorkflow = useCallback(
    async (runId: WorkflowRunId, direction: 'up' | 'down') => {
      const ids = [...task.workflowRuns].sort((a, b) => a.ordinal - b.ordinal).map((r) => r.id);
      const idx = ids.indexOf(runId);
      if (idx === -1) {
        return;
      }
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= ids.length) {
        return;
      }
      [ids[idx], ids[swap]] = [ids[swap]!, ids[idx]!];
      try {
        await reorderSessionWorkflows(task.id, ids);
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

  const onStartStepAgent = async (agent: Agent, model?: string) => {
    setSpawnError(null);
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    try {
      if (agent.status === 'pending') {
        await activateWorkflowAgent(task.id, agent.id);
        return;
      }
      await spawnAgent(task.id, {
        ...(agent.stepId != null && { stepId: agent.stepId }),
        ...(agent.workflowRunId != null && { workflowRunId: agent.workflowRunId }),
        ...(model !== undefined && { model }),
      });
    } catch (err) {
      setSpawnError(formatError(err));
    }
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
    agentsByRunId: tree.agentsByRunId,
    agentsExpanded,
    attachedRuns,
    blockReasonByRunId,
    childrenByParentId: tree.childrenByParentId,
    clusterExpand: tree.clusterExpand,
    countUnread: tree.countUnread,
    editingId,
    focusedWorkflowRunId,
    forceAdvanceWorkflowStep,
    hasAnyWorkflow: attachedRuns.length > 0,
    isTaskActive,
    isTranscriptLoading: loading.transcript,
    metrics,
    onDiscardWorkflow,
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
    startWorkflowRun,
    toggleClusterExpand: tree.toggleClusterExpand,
    toggleWorkflowExpand,
    visibleWorkflowRuns,
    workflowExpand,
    workflowExpanded,
    workflowNameByRunId,
    worktreePath,
  };
};
