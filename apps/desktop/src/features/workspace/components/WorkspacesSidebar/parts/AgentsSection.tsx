import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EmptyState, SectionHeader, cn } from '@goodboy/ui';
import { ArrowUpRight, CheckCheck, Layers } from 'lucide-react';
import { ScriptsSection } from '../../../../scripts/components/ScriptsSection';
import { DogMascot } from '../../../../../shared/components/DogMascot';
import type {
  Agent,
  AgentId,
  DiffComment,
  PrComment,
  ProviderName,
  ProviderRunId,
  Session,
  TelemetryRecord,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import type { ProviderContextUsage } from './ContextWindowBar';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
} from '../../../../../store';
import { classifyWorkflowChain } from '@goodboy/core';
import { pickNextWorkflowStep } from '../../../../../features/workflows/components/WorkflowNextStepCta';
import { workflowRunHasOpenQuestions } from '../../../../../features/context/openQuestionsGate';
import { PendingResolutionsStrip } from '../../../../../features/context/components/ContextPanel/strips/PendingResolutionsStrip';
import { computeLatestTelemetryByAgentId } from '../../../../../features/session/agent-row-format';
import { classifyAgent, type AgentKind } from '../../../../../features/session/agent-kind';
import { formatError } from '../../../../../shared/lib/errors';
import { SectionToggle } from './SectionToggle';
import { PlanReadySuggestion } from './PlanReadySuggestion';
import { ResolveCluster } from './ResolveCluster';
import { SpawnAgentControl } from './SpawnAgentControl';
import { WorkflowStartButton } from './WorkflowStartButton';
import { CollapsedSummary } from './CollapsedSummary';
import { AdHocRow } from './AdHocRow';
import { WorkflowRow } from './WorkflowRow';
import { pluralize, workflowKindName, type WorkflowBlockReason } from '../lib';

type AgentsSectionProps = {
  task: Session;
  only?: 'workflows' | 'agents' | 'scripts' | 'resolve';
};

export const AgentsSection = ({ task, only }: AgentsSectionProps) => {
  const showWorkflows = only == null || only === 'workflows';
  const showAgents = only == null || only === 'agents';
  const showScripts = only == null || only === 'scripts';
  const showResolve = only == null || only === 'resolve';
  const forceExpanded = only != null;
  const isTaskActive = useAppStore((s) => s.currentSessionId === task.id);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const messages = useAppStore((s) => s.messages[task.id] ?? EMPTY_ARRAY);
  const agentRunHistory = useAppStore(
    useShallow((s) => {
      const out: Record<string, ReadonlyArray<ProviderRunId>> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const history = s.agentRunHistory[run.id];
        if (history) {
          out[run.id] = history;
        }
      }
      return out;
    }),
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
  const prNumber = useAppStore((s) => s.sessionGithub[task.id]?.pr?.number ?? null);
  const resolvedThreadIds = useAppStore(
    useShallow(
      (s) =>
        new Set(
          (s.sessionGithub[task.id]?.detail?.comments ?? [])
            .filter((c) => c.resolved === true && c.threadId != null)
            .map((c) => c.threadId as string),
        ),
    ),
  );
  const pendingThreadIds = useAppStore(
    useShallow((s) => new Set((s.sessionPendingResolutions[task.id] ?? []).map((r) => r.threadId))),
  );
  const resolverState = useAppStore(
    useShallow((s) => {
      const out: Record<string, 'awaiting' | 'committed' | 'wontfix'> = {};
      const runs = s.sessionPhaseRuns[task.id];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const st = s.resolverState[run.id];
        if (st) {
          out[run.id] = st;
        }
      }
      return out;
    }),
  );
  const prComments = useAppStore(
    (s) => s.sessionGithub[task.id]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const diffComments = useAppStore(
    (s) => s.diffComments[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<DiffComment>),
  );
  const selectAgent = useAppStore((s) => s.selectAgent);
  const requestOpenQuestionScroll = useAppStore((s) => s.requestOpenQuestionScroll);
  const activateNextResolver = useAppStore((s) => s.activateNextResolver);
  const resolveGithubThread = useAppStore((s) => s.resolveGithubThread);
  const dequeueResolution = useAppStore((s) => s.dequeueResolution);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const forceAdvanceWorkflowStep = useAppStore((s) => s.forceAdvanceWorkflowStep);
  const renameAgent = useAppStore((s) => s.renameAgent);
  const deleteAgent = useAppStore((s) => s.deleteAgent);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[task.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionWorkflows = useAppStore(
    (s) => s.sessionWorkflows[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const attachedRuns = useMemo<ReadonlyArray<{ run: WorkflowRun; workflow: Workflow }>>(() => {
    const byId = new Map<string, Workflow>();
    for (const w of phaseTemplates) byId.set(w.id, w);
    for (const w of sessionWorkflows) byId.set(w.id, w);
    return [...task.workflowRuns]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((run) => {
        const workflow = byId.get(run.workflowId);
        return workflow ? { run, workflow } : null;
      })
      .filter((e): e is { run: WorkflowRun; workflow: Workflow } => e !== null);
  }, [task.workflowRuns, phaseTemplates, sessionWorkflows]);
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
  const [resolveExpanded, setResolveExpanded] = useState(true);
  const setPanelSectionExpanded = useAppStore((s) => s.setPanelSectionExpanded);
  const workflowExpanded = useAppStore((s) => s.sessionPanelExpanded[task.id]?.workflow ?? true);
  const [clusterExpand, setClusterExpand] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleClusterExpand = useCallback((id: string) => {
    setClusterExpand((prev) => {
      const next = new Map(prev);
      next.set(id, !(prev.get(id) ?? false));
      return next;
    });
  }, []);

  const sorted = useMemo(() => [...phaseRuns].sort((a, b) => a.ordinal - b.ordinal), [phaseRuns]);
  const agentsByRunId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const r of sorted) {
      if (r.stepId == null || r.workflowRunId == null) {
        continue;
      }
      const bucket = map.get(r.workflowRunId) ?? [];
      bucket.push(r);
      map.set(r.workflowRunId, bucket);
    }
    return map;
  }, [sorted]);
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const r of sorted) {
      if (r.parentAgentId == null) {
        continue;
      }
      const bucket = map.get(r.parentAgentId) ?? [];
      bucket.push(r);
      map.set(r.parentAgentId, bucket);
    }
    return map;
  }, [sorted]);
  const adHocAgents = useMemo(
    () =>
      sorted.filter(
        (r) => r.parentAgentId == null && !(r.workflowRunId != null && r.stepId != null),
      ),
    [sorted],
  );
  const countUnread = useCallback(
    (agentsList: ReadonlyArray<Agent>): number => {
      let n = 0;
      const visit = (a: Agent) => {
        if (agentHasUnread(a, a.id === selectedAgentId && isTaskActive)) {
          n += 1;
        }
        for (const c of childrenByParentId.get(a.id) ?? EMPTY_ARRAY) {
          visit(c);
        }
      };
      for (const a of agentsList) {
        visit(a);
      }
      return n;
    },
    [childrenByParentId, selectedAgentId, isTaskActive],
  );
  const actionableStepIdByRunId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const { run, workflow } of attachedRuns) {
      if (run.discardedAt) {
        map.set(run.id, null);
        continue;
      }
      const runAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
      map.set(run.id, pickNextWorkflowStep(workflow, runAgents)?.id ?? null);
    }
    return map;
  }, [attachedRuns, agentsByRunId]);
  const blockReasonByRunId = useMemo(() => {
    const map = new Map<string, WorkflowBlockReason | null>();
    for (const { run, workflow } of attachedRuns) {
      const runAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
      const reason: WorkflowBlockReason | null = workflowRunHasOpenQuestions(openQuestions, run.id)
        ? 'questions'
        : summarizerBusy
          ? 'summarizer'
          : classifyWorkflowChain(workflow, runAgents).kind === 'blocked'
            ? 'failed-step'
            : null;
      map.set(run.id, reason);
    }
    return map;
  }, [attachedRuns, agentsByRunId, openQuestions, summarizerBusy]);

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

  const telemetryByRunId = useMemo(() => {
    const map = new Map<string, TelemetryRecord>();
    for (const rec of telemetry) {
      const existing = map.get(rec.runId);
      if (!existing || existing.recordedAt < rec.recordedAt) {
        map.set(rec.runId, rec);
      }
    }
    return map;
  }, [telemetry]);

  const turnsByAgentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of messages) {
      if (m.role !== 'user') {
        continue;
      }
      map.set(m.agentId, (map.get(m.agentId) ?? 0) + 1);
    }
    return map;
  }, [messages]);

  const firstUserTextByAgentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const message of messages) {
      if (message.role !== 'user') {
        continue;
      }
      if (map.has(message.agentId)) {
        continue;
      }
      map.set(message.agentId, message.content);
    }
    return map;
  }, [messages]);

  const resolverAgents = useMemo(
    () =>
      sorted.filter(
        (r) =>
          r.parentAgentId == null &&
          r.stepId == null &&
          classifyAgent(r, agentKindOverride[r.id] ?? null) === 'resolver',
      ),
    [sorted, agentKindOverride],
  );
  const resolverIds = useMemo(() => new Set(resolverAgents.map((r) => r.id)), [resolverAgents]);
  const commentByThreadId = useMemo(() => {
    const map = new Map<string, PrComment>();
    for (const c of prComments) {
      if (c.threadId == null || c.inReplyToId != null) {
        continue;
      }
      if (!map.has(c.threadId)) {
        map.set(c.threadId, c);
      }
    }
    return map;
  }, [prComments]);
  const diffCommentByAgentId = useMemo(() => {
    const map = new Map<AgentId, DiffComment>();
    for (const c of diffComments) {
      if (c.consumedByAgentId != null) {
        map.set(c.consumedByAgentId, c);
      }
    }
    return map;
  }, [diffComments]);
  const onResolveThread = useCallback(
    async (threadId: string) => {
      const ok = await resolveGithubThread(task.id, threadId);
      if (ok) {
        await dequeueResolution(task.id, threadId);
      }
    },
    [resolveGithubThread, dequeueResolution, task.id],
  );
  const standaloneAgentCount = useMemo(
    () => adHocAgents.filter((r) => !resolverIds.has(r.id)).length,
    [adHocAgents, resolverIds],
  );
  const agentsExpanded = useAppStore(
    (s) => s.sessionPanelExpanded[task.id]?.agents ?? standaloneAgentCount > 0,
  );

  const aggregatesByAgentId = useMemo(() => {
    const map = new Map<
      string,
      { inputTokens: number; outputTokens: number; estimatedCostUsd: number; turns: number }
    >();
    const telemetryByRun = new Map<string, TelemetryRecord>();
    for (const rec of telemetry) {
      if (rec.kind !== 'turn') {
        continue;
      }
      const existing = telemetryByRun.get(rec.runId);
      if (!existing || existing.recordedAt < rec.recordedAt) {
        telemetryByRun.set(rec.runId, rec);
      }
    }
    for (const run of phaseRuns) {
      const runIds = agentRunHistory[run.id] ?? (run.runId ? [run.runId] : []);
      let inputTokens = 0;
      let outputTokens = 0;
      let estimatedCostUsd = 0;
      let turns = 0;
      for (const rid of runIds) {
        const rec = telemetryByRun.get(rid);
        if (!rec) {
          continue;
        }
        inputTokens += rec.inputTokens;
        outputTokens += rec.outputTokens;
        estimatedCostUsd += rec.estimatedCostUsd;
        turns += 1;
      }
      map.set(run.id, { inputTokens, outputTokens, estimatedCostUsd, turns });
    }
    const childIds = new Map<string, string[]>();
    for (const run of phaseRuns) {
      if (run.parentAgentId == null) {
        continue;
      }
      const bucket = childIds.get(run.parentAgentId) ?? [];
      bucket.push(run.id);
      childIds.set(run.parentAgentId, bucket);
    }
    const rolled = new Set<string>();
    const rollup = (id: string) => {
      if (rolled.has(id)) {
        return;
      }
      rolled.add(id);
      const self = map.get(id);
      if (!self) {
        return;
      }
      for (const cid of childIds.get(id) ?? []) {
        rollup(cid);
        const child = map.get(cid);
        if (!child) {
          continue;
        }
        self.inputTokens += child.inputTokens;
        self.outputTokens += child.outputTokens;
        self.estimatedCostUsd += child.estimatedCostUsd;
        self.turns += child.turns;
      }
    };
    for (const run of phaseRuns) rollup(run.id);
    return map;
  }, [telemetry, phaseRuns, agentRunHistory]);

  const providerUsageByAgentId = useMemo(() => {
    type Entry = {
      provider: ProviderName;
      model: string;
      recordedAt: string;
      inputTokens: number;
      outputTokens: number;
    };
    const merge = (target: Map<ProviderName, Entry>, rec: Entry) => {
      const e = target.get(rec.provider);
      if (!e) {
        target.set(rec.provider, { ...rec });
        return;
      }
      e.inputTokens += rec.inputTokens;
      e.outputTokens += rec.outputTokens;
      if (e.recordedAt < rec.recordedAt) {
        e.recordedAt = rec.recordedAt;
        e.model = rec.model;
      }
    };
    const telemetryByRun = new Map<string, TelemetryRecord>();
    for (const rec of telemetry) {
      if (rec.kind !== 'turn') {
        continue;
      }
      const existing = telemetryByRun.get(rec.runId);
      if (!existing || existing.recordedAt < rec.recordedAt) {
        telemetryByRun.set(rec.runId, rec);
      }
    }
    const map = new Map<string, Map<ProviderName, Entry>>();
    for (const run of phaseRuns) {
      const runIds = agentRunHistory[run.id] ?? (run.runId ? [run.runId] : []);
      const byProvider = new Map<ProviderName, Entry>();
      for (const rid of runIds) {
        const rec = telemetryByRun.get(rid);
        if (!rec) {
          continue;
        }
        merge(byProvider, {
          provider: rec.provider,
          model: rec.model,
          recordedAt: rec.recordedAt,
          inputTokens: rec.inputTokens,
          outputTokens: rec.outputTokens,
        });
      }
      map.set(run.id, byProvider);
    }
    const childIds = new Map<string, string[]>();
    for (const run of phaseRuns) {
      if (run.parentAgentId == null) {
        continue;
      }
      const bucket = childIds.get(run.parentAgentId) ?? [];
      bucket.push(run.id);
      childIds.set(run.parentAgentId, bucket);
    }
    const rolled = new Set<string>();
    const rollup = (id: string) => {
      if (rolled.has(id)) {
        return;
      }
      rolled.add(id);
      const self = map.get(id);
      if (!self) {
        return;
      }
      for (const cid of childIds.get(id) ?? []) {
        rollup(cid);
        const child = map.get(cid);
        if (!child) {
          continue;
        }
        for (const ce of child.values()) {
          merge(self, ce);
        }
      }
    };
    for (const run of phaseRuns) rollup(run.id);
    const result = new Map<string, ReadonlyArray<ProviderContextUsage>>();
    for (const [id, byProvider] of map) {
      const list = [...byProvider.values()]
        .map((e) => ({
          provider: e.provider,
          model: e.model,
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
        }))
        .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
      result.set(id, list);
    }
    return result;
  }, [telemetry, phaseRuns, agentRunHistory]);

  const latestTelemetryByAgentId = useMemo(
    () => computeLatestTelemetryByAgentId(phaseRuns, agentRunHistory, telemetryByRunId),
    [telemetryByRunId, phaseRuns, agentRunHistory],
  );

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

  const onDeleteAgent = async (id: AgentId) => {
    try {
      await deleteAgent(task.id, id);
    } catch (err) {
      setSpawnError(formatError(err));
    }
  };

  const hasAnyWorkflow = attachedRuns.length > 0;

  const wfExpanded = forceExpanded || workflowExpanded;
  const agExpanded = forceExpanded || agentsExpanded;

  return (
    <section className="flex flex-col">
      {showWorkflows ? (
        <>
          {forceExpanded ? null : (
            <SectionHeader
              className="pb-1.5"
              icon={<Layers size={11} aria-hidden className="text-primary" />}
              label="Workflow"
              action={
                <SectionToggle
                  expanded={workflowExpanded}
                  label="workflow"
                  onToggle={() => setPanelSectionExpanded(task.id, 'workflow', !workflowExpanded)}
                />
              }
            />
          )}
          {wfExpanded ? (
            !hasAnyWorkflow ? (
              <WorkflowStartButton sessionId={task.id} variant="empty" />
            ) : (
              <>
                <div className={cn('flex flex-col', forceExpanded ? 'gap-3' : 'gap-0.5')}>
                  {attachedRuns.map(({ run, workflow }, index) => (
                    <WorkflowRow
                      key={run.id}
                      run={run}
                      workflow={workflow}
                      index={index}
                      task={task}
                      attachedRuns={attachedRuns}
                      agentsByRunId={agentsByRunId}
                      actionableStepIdByRunId={actionableStepIdByRunId}
                      blockReasonByRunId={blockReasonByRunId}
                      countUnread={countUnread}
                      focusedWorkflowRunId={focusedWorkflowRunId}
                      workflowExpand={workflowExpand}
                      workflowNameByRunId={workflowNameByRunId}
                      forceExpanded={forceExpanded}
                      toggleWorkflowExpand={toggleWorkflowExpand}
                      startWorkflowRun={startWorkflowRun}
                      setWorkflowRunAutoRun={setWorkflowRunAutoRun}
                      onReorderWorkflow={onReorderWorkflow}
                      onDiscardWorkflow={onDiscardWorkflow}
                      agentKindOverride={agentKindOverride}
                      agentModelOverride={agentModelOverride}
                      childrenByParentId={childrenByParentId}
                      clusterExpand={clusterExpand}
                      selectedAgentId={selectedAgentId}
                      isTaskActive={isTaskActive}
                      editingId={editingId}
                      latestTelemetryByAgentId={latestTelemetryByAgentId}
                      aggregatesByAgentId={aggregatesByAgentId}
                      providerUsageByAgentId={providerUsageByAgentId}
                      turnsByAgentId={turnsByAgentId}
                      isTranscriptLoading={loading.transcript}
                      onStartStepAgent={onStartStepAgent}
                      onPickAgent={onPickAgent}
                      setEditingId={setEditingId}
                      onRenameCommit={onRenameCommit}
                      onResolveFirstForRun={onResolveFirstForRun}
                      toggleClusterExpand={toggleClusterExpand}
                      forceAdvanceWorkflowStep={forceAdvanceWorkflowStep}
                    />
                  ))}
                </div>
                <WorkflowStartButton sessionId={task.id} variant="attach" />
              </>
            )
          ) : (
            <CollapsedSummary
              text={
                hasAnyWorkflow ? pluralize(attachedRuns.length, 'workflow') : 'No workflows yet'
              }
            />
          )}
        </>
      ) : null}

      {showAgents ? (
        <>
          {forceExpanded ? null : (
            <SectionHeader
              className="mt-6 pb-1.5"
              icon={<DogMascot size={14} className="shrink-0 text-success" />}
              label="Agents"
              action={
                <SectionToggle
                  expanded={agentsExpanded}
                  label="agents"
                  onToggle={() => setPanelSectionExpanded(task.id, 'agents', !agentsExpanded)}
                />
              }
            />
          )}
          {agExpanded ? (
            <>
              {hasAnyWorkflow ? (
                adHocAgents.some((r) => !resolverIds.has(r.id)) ? (
                  <ul className="flex flex-col gap-1 pl-2">
                    {adHocAgents
                      .filter((r) => !resolverIds.has(r.id))
                      .map((run, index) => (
                        <AdHocRow
                          key={run.id}
                          run={run}
                          index={index}
                          firstUserTextByAgentId={firstUserTextByAgentId}
                          agentKindOverride={agentKindOverride}
                          childrenByParentId={childrenByParentId}
                          latestTelemetryByAgentId={latestTelemetryByAgentId}
                          aggregatesByAgentId={aggregatesByAgentId}
                          providerUsageByAgentId={providerUsageByAgentId}
                          turnsByAgentId={turnsByAgentId}
                          selectedAgentId={selectedAgentId}
                          isTranscriptLoading={loading.transcript}
                          isTaskActive={isTaskActive}
                          editingId={editingId}
                          setEditingId={setEditingId}
                          clusterExpand={clusterExpand}
                          toggleClusterExpand={toggleClusterExpand}
                          onPickAgent={onPickAgent}
                          onRenameCommit={onRenameCommit}
                          onDeleteAgent={onDeleteAgent}
                        />
                      ))}
                  </ul>
                ) : null
              ) : sorted.length === 0 ? (
                loading.agents ? (
                  <ul
                    role="status"
                    aria-label="loading agents"
                    className="flex flex-col gap-1 pl-2"
                  >
                    {[0, 1].map((i) => (
                      <li key={i} className="flex items-center gap-2 rounded px-2 py-1.5">
                        <span className="h-3 w-3 motion-safe:animate-pulse rounded-full bg-muted" />
                        <span className="h-3 flex-1 motion-safe:animate-pulse rounded bg-muted" />
                      </li>
                    ))}
                  </ul>
                ) : resolverAgents.length === 0 ? (
                  forceExpanded ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-6 py-10 text-center">
                      <span
                        aria-hidden
                        className="flex size-12 items-center justify-center rounded-full bg-success/10"
                      >
                        <DogMascot size={26} className="text-success" />
                      </span>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-foreground">No agents yet</p>
                        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                          Spawn an agent to start working on this session, or kick off a workflow to
                          run a sequence of agents toward the goal.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="px-2 py-2 text-xs text-muted-foreground/70">
                      No agents yet. Spawn one below.
                    </p>
                  )
                ) : null
              ) : (
                <ul className="flex flex-col gap-1 pl-2">
                  {sorted
                    .filter((r) => !resolverIds.has(r.id))
                    .map((run, index) => (
                      <AdHocRow
                        key={run.id}
                        run={run}
                        index={index}
                        firstUserTextByAgentId={firstUserTextByAgentId}
                        agentKindOverride={agentKindOverride}
                        childrenByParentId={childrenByParentId}
                        latestTelemetryByAgentId={latestTelemetryByAgentId}
                        aggregatesByAgentId={aggregatesByAgentId}
                        providerUsageByAgentId={providerUsageByAgentId}
                        turnsByAgentId={turnsByAgentId}
                        selectedAgentId={selectedAgentId}
                        isTranscriptLoading={loading.transcript}
                        isTaskActive={isTaskActive}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        clusterExpand={clusterExpand}
                        toggleClusterExpand={toggleClusterExpand}
                        onPickAgent={onPickAgent}
                        onRenameCommit={onRenameCommit}
                        onDeleteAgent={onDeleteAgent}
                      />
                    ))}
                </ul>
              )}
              <SpawnAgentControl sessionId={task.id} />
              {spawnError ? <p className="mt-1 px-2 text-2xs text-danger">{spawnError}</p> : null}
            </>
          ) : (
            <CollapsedSummary
              text={
                standaloneAgentCount === 0
                  ? 'No agents yet'
                  : pluralize(standaloneAgentCount, 'agent')
              }
            />
          )}
          <PlanReadySuggestion task={task} />
        </>
      ) : null}

      {showScripts ? (
        <ScriptsSection
          sessionId={task.id}
          workspaceId={task.workspaceId}
          worktreePath={worktreePath}
          forceExpanded={forceExpanded}
          hideHeader={forceExpanded}
        />
      ) : null}

      {showResolve ? (
        resolverAgents.length > 0 ? (
          <>
            {forceExpanded ? null : (
              <SectionHeader
                className="mt-6 pb-1.5"
                icon={<CheckCheck size={11} aria-hidden className="text-success" />}
                label="Resolve"
              />
            )}
            <div className="px-2 pb-1">
              <PendingResolutionsStrip sessionId={task.id} />
            </div>
            <ResolveCluster
              agents={resolverAgents}
              sessionId={task.id}
              isTaskActive={isTaskActive}
              prNumber={prNumber}
              resolvedThreadIds={resolvedThreadIds}
              pendingThreadIds={pendingThreadIds}
              resolverState={resolverState}
              commentByThreadId={commentByThreadId}
              diffCommentByAgentId={diffCommentByAgentId}
              selectedAgentId={selectedAgentId}
              expanded={forceExpanded || resolveExpanded}
              onToggle={() => setResolveExpanded((v) => !v)}
              onSelect={onPickAgent}
              onForceNext={() => void activateNextResolver(task.id)}
              onResolveThread={onResolveThread}
            />
          </>
        ) : forceExpanded ? (
          <div className="flex flex-col gap-3">
            <PendingResolutionsStrip sessionId={task.id} />
            <EmptyState
              bordered
              tone="success"
              icon={CheckCheck}
              title="Nothing to resolve"
              description="Spawn a resolver from a pull request comment or a diff selection and it will show up here."
              action={
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('goodboy:open-github-session', {
                        detail: { sessionId: task.id },
                      }),
                    )
                  }
                  className="mt-1 inline-flex items-center justify-center gap-1 self-center rounded-lg bg-foreground/[0.04] px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]"
                >
                  Resolve comments
                  <ArrowUpRight size={13} aria-hidden className="shrink-0 opacity-70" />
                </button>
              }
            />
          </div>
        ) : null
      ) : null}
    </section>
  );
};
