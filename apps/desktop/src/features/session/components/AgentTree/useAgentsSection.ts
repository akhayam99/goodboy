import { useCallback, useMemo, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import type {
  Agent,
  AgentId,
  EffortLevel,
  OpenQuestion,
  ProviderId,
  Session,
  SessionId,
  TurnState,
  WorkflowRunId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../store';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { resolveWorkflowAdvance, type WorkflowBlockReason } from '../../../workflows/advanceGate';
import { viewWorkflowAdvance } from '../../../workflows/workflowAdvanceView';
import { WORKFLOW_BLOCK_COPY } from '../../../workflows/blockCopy';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import { classifyAgent, type AgentKind } from '../../agent-kind';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { useSessionAgentTree } from './useSessionAgentTree';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';

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
  const agentEffortOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, EffortLevel> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const effort = s.agentEffortOverride[run.id];
        if (effort !== undefined) {
          out[run.id] = effort;
        }
      }
      return out;
    }),
  );
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[task.id] ?? null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const detachWorkflowFromSession = useAppStore((s) => s.detachWorkflowFromSession);
  const attachedRuns = useAttachedWorkflowRuns({ session: task });
  const discardWorkflow = useAppStore((s) => s.discardWorkflow);
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
  const focusQuestion = useOpenQuestions((s) => s.focusQuestion);
  const summarizerBusy = useAppStore((s) => s.summarizerStatus[task.id]?.status === 'running');
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const workflowExpand = useAppStore((s) => s.workflowExpand[task.id]);
  const focusedWorkflowRunId = useAppStore((s) => s.focusedWorkflowRunId?.[task.id] ?? null);
  const toggleWorkflowExpand = useAppStore((s) => s.toggleWorkflowExpand);
  const setPanelSectionExpanded = useAppStore((s) => s.setPanelSectionExpanded);
  const workflowExpanded = useAppStore((s) => s.sessionPanelExpanded[task.id]?.workflow ?? true);
  const tree = useSessionAgentTree({ phaseRuns });
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
          hasOpenQuestions: workflowRunHasOpenQuestions({ questions: openQuestions, run }),
          isSummarizerRunning: summarizerBusy,
          isTurnRunning: runAgents.some((agent) => {
            const turn = agentTurnState[agent.id];
            return turn?.kind === 'running' || turn?.kind === 'starting';
          }),
        }),
      });
      actionableStepIdByRunId.set(run.id, run.discardedAt ? null : (view.chainStep?.id ?? null));
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

  const standaloneAgentCount = useMemo(
    () =>
      tree.adHocAgents.filter(
        (agent) =>
          classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null }) !== 'resolver',
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

  const onAnswerQuestion = (question: OpenQuestion | null) => {
    if (question != null) {
      focusQuestion(question.id);
    }
    setActiveLens(task.id, 'questions');
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

  const visibleWorkflowRuns =
    workflowRunId == null
      ? attachedRuns
      : attachedRuns.filter(({ run }) => run.id === workflowRunId);

  return {
    actionableStepIdByRunId,
    agentKindOverride,
    agentModelOverride,
    agentProviderOverride,
    agentEffortOverride,
    agentsByRunId: tree.agentsByRunId,
    agentsExpanded,
    attachedRuns,
    blockReasonByRunId,
    childrenByParentId: tree.childrenByParentId,
    focusedWorkflowRunId,
    hasAnyWorkflow: attachedRuns.length > 0,
    onAnswerQuestion,
    metrics,
    onDiscardWorkflow,
    onDeleteWorkflow,
    onPickAgent,
    onStartStepAgent,
    selectedAgentId,
    setPanelSectionExpanded,
    setWorkflowRunAutoRun,
    spawnError,
    standaloneAgentCount,
    startWorkflowRun: onStartWorkflowRun,
    toggleWorkflowExpand,
    visibleWorkflowRuns,
    workflowExpand,
    workflowExpanded,
    workflowNameByRunId,
  };
};
