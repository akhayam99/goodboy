import { Fragment, useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SectionHeader, cn } from '@goodboy/ui';
import {
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  Link2,
  Pause,
  Play,
  Zap,
  ZapOff,
} from 'lucide-react';
import { ScriptsSection } from '../../../../scripts/components/ScriptsSection';
import { DogMascot } from '../../../../../shared/components/DogMascot';
import type {
  Agent,
  AgentId,
  ProviderRunId,
  Session,
  TelemetryRecord,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
} from '../../../../../store';
import { pickNextWorkflowStep } from '../../../../../features/workflows/components/WorkflowNextStepCta';
import { workflowRunHasOpenQuestions } from '../../../../../features/context/openQuestionsGate';
import { computeLatestTelemetryByAgentId } from '../../../../../features/session/agent-row-format';
import {
  AGENT_KIND_DEFAULTS,
  type AgentKind,
  inferAgentKindFromName,
  resolveAgentKind,
} from '../../../../../features/session/agent-kind';
import { formatError } from '../../../../../shared/lib/errors';
import { SectionToggle } from './SectionToggle';
import { PlanReadySuggestion } from './PlanReadySuggestion';
import { AgentRow } from './AgentRow';
import { WorkflowStepRow } from './WorkflowStepRow';
import { ResolveCluster } from './ResolveCluster';
import { ScoutSubtree } from './ScoutSubtree';
import { ClusterChildRow } from './ClusterChildRow';
import { SpawnAgentControl } from './SpawnAgentControl';
import { WorkflowKillButton } from './WorkflowKillButton';
import { WorkflowStartButton } from './WorkflowStartButton';
import { CollapsedSummary } from './CollapsedSummary';
import { pluralize, workflowKindName, type WorkflowBlockReason } from '../lib';

type AgentsSectionProps = {
  task: Session;
};

export function AgentsSection({ task }: AgentsSectionProps) {
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
  const selectAgent = useAppStore((s) => s.selectAgent);
  const activateNextResolver = useAppStore((s) => s.activateNextResolver);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
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
  const [workflowExpand, setWorkflowExpand] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleWorkflowExpand = useCallback((id: string, isDiscarded: boolean) => {
    setWorkflowExpand((prev) => {
      const next = new Map(prev);
      next.set(id, !(prev.get(id) ?? !isDiscarded));
      return next;
    });
  }, []);
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
    for (const { run } of attachedRuns) {
      const reason = workflowRunHasOpenQuestions(openQuestions, run.id)
        ? 'questions'
        : summarizerBusy
          ? 'summarizer'
          : null;
      map.set(run.id, reason);
    }
    return map;
  }, [attachedRuns, openQuestions, summarizerBusy]);

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
    for (const m of messages) {
      if (m.role !== 'user') {
        continue;
      }
      if (map.has(m.agentId)) {
        continue;
      }
      map.set(m.agentId, m.content);
    }
    return map;
  }, [messages]);

  const resolverAgents = useMemo(
    () =>
      sorted.filter(
        (r) =>
          r.parentAgentId == null &&
          r.stepId == null &&
          resolveAgentKind(
            r.name,
            firstUserTextByAgentId.get(r.id) ?? null,
            agentKindOverride[r.id] ?? null,
          ) === 'resolver',
      ),
    [sorted, firstUserTextByAgentId, agentKindOverride],
  );
  const resolverIds = useMemo(() => new Set(resolverAgents.map((r) => r.id)), [resolverAgents]);
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

  const renderAdHocRow = (run: Agent, index: number) => {
    const kind = resolveAgentKind(
      run.name,
      firstUserTextByAgentId.get(run.id) ?? null,
      agentKindOverride[run.id] ?? null,
    );
    const scoutChildren = childrenByParentId.get(run.id) ?? EMPTY_ARRAY;
    return (
      <Fragment key={run.id}>
        <AgentRow
          run={run}
          kind={kind}
          index={index}
          telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
          aggregate={aggregatesByAgentId.get(run.id) ?? null}
          turns={turnsByAgentId.get(run.id) ?? 0}
          turnsLoading={run.id === selectedAgentId && loading.transcript}
          isSelected={run.id === selectedAgentId}
          isTaskActive={isTaskActive}
          isEditing={editingId === run.id}
          onClick={() => onPickAgent(run.id)}
          onRenameStart={() => setEditingId(run.id)}
          onRenameCommit={(name) => void onRenameCommit(run.id, name)}
          onRenameCancel={() => setEditingId(null)}
          onDelete={() => void onDeleteAgent(run.id)}
        />
        {scoutChildren.length > 0 && (
          <li>
            <ScoutSubtree
              containerId={run.id}
              depth={0}
              childrenByParentId={childrenByParentId}
              aggregatesByAgentId={aggregatesByAgentId}
              selectedAgentId={selectedAgentId}
              expandState={clusterExpand}
              onToggle={toggleClusterExpand}
              onSelect={onPickAgent}
            />
          </li>
        )}
      </Fragment>
    );
  };

  const hasAnyWorkflow = attachedRuns.length > 0;
  const renderWorkflowRow = (
    { run, workflow }: { run: WorkflowRun; workflow: Workflow },
    idx: number,
  ) => {
    const isDiscarded = run.discardedAt != null;
    const expanded = workflowExpand.get(run.id) ?? !isDiscarded;
    const wfAgents = agentsByRunId.get(run.id) ?? EMPTY_ARRAY;
    const actionableStepId = actionableStepIdByRunId.get(run.id) ?? null;
    const wfBlockReason = blockReasonByRunId.get(run.id) ?? null;
    const canMoveUp = idx > 0;
    const canMoveDown = idx < attachedRuns.length - 1;
    const name = workflowKindName(workflow);
    const total = workflow.steps.length;
    const done = wfAgents.filter((a) => a.status === 'completed' || a.status === 'skipped').length;
    const isCompleted = !isDiscarded && total > 0 && done >= total;
    const hasStarted = wfAgents.length > 0;
    const isQueuedManual = !isDiscarded && run.triggerMode === 'manual' && !hasStarted;
    const isQueuedAfter = !isDiscarded && run.triggerMode === 'after_run' && !hasStarted;
    const predecessorName = run.chainAfterId
      ? (workflowNameByRunId.get(run.chainAfterId) ?? 'previous')
      : 'previous';
    return (
      <div key={run.id} className={cn('flex flex-col', isDiscarded && 'opacity-70')}>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => toggleWorkflowExpand(run.id, isDiscarded)}
            title={workflow.name || name}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'collapse' : 'expand'} ${name} workflow`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-muted/50"
          >
            {expanded ? (
              <ChevronDown size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
            ) : (
              <ChevronRight size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
            )}
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {name}
            </span>
            {isDiscarded ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Ban size={10} aria-hidden /> discarded
              </span>
            ) : isCompleted ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                <Check size={10} aria-hidden /> completed
              </span>
            ) : isQueuedManual ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Pause size={10} aria-hidden /> queued (manual)
              </span>
            ) : isQueuedAfter ? (
              <span
                className="inline-flex max-w-[10rem] shrink-0 items-center gap-1 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                title={`after ${predecessorName}`}
              >
                <Link2 size={10} aria-hidden /> after {predecessorName}
              </span>
            ) : total > 0 ? (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
                {done}/{total}
              </span>
            ) : null}
          </button>
          {!isDiscarded && !isCompleted && (
            <div className="flex shrink-0 items-center">
              {isQueuedManual ? (
                <button
                  type="button"
                  onClick={() => void startWorkflowRun(task.id, run.id)}
                  title="start this workflow now"
                  aria-label="start workflow now"
                  className="rounded p-0.5 text-success transition-colors hover:bg-success/15"
                >
                  <Play size={11} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void setWorkflowRunAutoRun(task.id, run.id, !run.autoRun)}
                title={run.autoRun ? 'autorun on, click to pause' : 'autorun off, click to enable'}
                aria-label={run.autoRun ? 'autorun on' : 'autorun off'}
                aria-pressed={run.autoRun}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  run.autoRun
                    ? 'text-danger hover:bg-danger/15'
                    : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
                )}
              >
                {run.autoRun ? <Zap size={11} aria-hidden /> : <ZapOff size={11} aria-hidden />}
              </button>
              {attachedRuns.length > 1 && (
                <>
                  <button
                    type="button"
                    disabled={!canMoveUp}
                    onClick={() => void onReorderWorkflow(run.id, 'up')}
                    title="move workflow up"
                    aria-label="move workflow up"
                    className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronUp size={11} aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={!canMoveDown}
                    onClick={() => void onReorderWorkflow(run.id, 'down')}
                    title="move workflow down"
                    aria-label="move workflow down"
                    className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronDown size={11} aria-hidden />
                  </button>
                </>
              )}
              <WorkflowKillButton onConfirm={() => void onDiscardWorkflow(run.id)} />
            </div>
          )}
        </div>
        {expanded ? (
          wfAgents.length > 0 ? (
            <div className="flex flex-col gap-1 pb-1 pl-3">
              {wfAgents.map((run, index) => {
                const isActionable = run.stepId === actionableStepId && run.status === 'pending';
                const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
                const stepModel =
                  run.stepId != null
                    ? workflow.steps.find((s) => s.id === run.stepId)?.modelOverride
                    : undefined;
                const resolvedModel =
                  stepModel ??
                  agentModelOverride[run.id] ??
                  run.modelOverride ??
                  AGENT_KIND_DEFAULTS[kind].model;
                const clusterChildren = childrenByParentId.get(run.id) ?? EMPTY_ARRAY;
                const clustersExpanded = clusterExpand.get(run.id) ?? false;
                return (
                  <Fragment key={run.id}>
                    <WorkflowStepRow
                      run={run}
                      kind={kind}
                      index={index}
                      resolvedModel={resolvedModel}
                      isActionable={isActionable}
                      blockReason={isActionable ? wfBlockReason : null}
                      isSelected={run.id === selectedAgentId}
                      isTaskActive={isTaskActive}
                      isEditing={editingId === run.id}
                      telemetry={latestTelemetryByAgentId.get(run.id) ?? null}
                      aggregate={aggregatesByAgentId.get(run.id) ?? null}
                      turns={turnsByAgentId.get(run.id) ?? 0}
                      turnsLoading={run.id === selectedAgentId && loading.transcript}
                      onStart={() => void onStartStepAgent(run)}
                      onSelect={() => onPickAgent(run.id)}
                      onRenameStart={() => setEditingId(run.id)}
                      onRenameCommit={(name) => void onRenameCommit(run.id, name)}
                      onRenameCancel={() => setEditingId(null)}
                    />
                    {clusterChildren.length === 0 ? null : kind === 'scout' ? (
                      <ScoutSubtree
                        containerId={run.id}
                        depth={0}
                        childrenByParentId={childrenByParentId}
                        aggregatesByAgentId={aggregatesByAgentId}
                        selectedAgentId={selectedAgentId}
                        expandState={clusterExpand}
                        onToggle={toggleClusterExpand}
                        onSelect={onPickAgent}
                      />
                    ) : (
                      <div className="ml-3 flex flex-col gap-0.5 border-l border-border-soft/60 pl-2">
                        <button
                          type="button"
                          onClick={() => toggleClusterExpand(run.id)}
                          aria-expanded={clustersExpanded}
                          aria-label={`${clustersExpanded ? 'collapse' : 'expand'} clusters for ${run.name}`}
                          className="flex items-center gap-1 px-2 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                        >
                          {clustersExpanded ? (
                            <ChevronDown size={10} aria-hidden className="shrink-0" />
                          ) : (
                            <ChevronRight size={10} aria-hidden className="shrink-0" />
                          )}
                          <span className="min-w-0 truncate">
                            clusters{' '}
                            {clusterChildren.filter((c) => c.status === 'completed').length}/
                            {clusterChildren.length}
                          </span>
                        </button>
                        {clustersExpanded
                          ? clusterChildren.map((child, ci) => (
                              <ClusterChildRow
                                key={child.id}
                                child={child}
                                index={ci}
                                total={clusterChildren.length}
                                costUsd={aggregatesByAgentId.get(child.id)?.estimatedCostUsd ?? 0}
                                isSelected={child.id === selectedAgentId}
                                onSelect={() => onPickAgent(child.id)}
                              />
                            ))
                          : null}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <p className="pb-1 pl-3 text-2xs text-muted-foreground/60">
              No agents yet for this workflow.
            </p>
          )
        ) : null}
      </div>
    );
  };

  return (
    <section className="mt-2 flex flex-col px-2 pb-3">
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
      {workflowExpanded ? (
        !hasAnyWorkflow ? (
          <WorkflowStartButton sessionId={task.id} variant="empty" />
        ) : (
          <>
            <div className="flex flex-col gap-0.5">{attachedRuns.map(renderWorkflowRow)}</div>
            <WorkflowStartButton sessionId={task.id} variant="attach" />
          </>
        )
      ) : (
        <CollapsedSummary
          text={hasAnyWorkflow ? pluralize(attachedRuns.length, 'workflow') : 'No workflows yet'}
        />
      )}

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
      {agentsExpanded ? (
        <>
          {hasAnyWorkflow ? (
            adHocAgents.some((r) => !resolverIds.has(r.id)) ? (
              <ul className="flex flex-col gap-1 pl-2">
                {adHocAgents.filter((r) => !resolverIds.has(r.id)).map(renderAdHocRow)}
              </ul>
            ) : null
          ) : sorted.length === 0 ? (
            loading.agents ? (
              <ul role="status" aria-label="loading agents" className="flex flex-col gap-1 pl-2">
                {[0, 1].map((i) => (
                  <li key={i} className="flex items-center gap-2 rounded px-2 py-1.5">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                    <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
                  </li>
                ))}
              </ul>
            ) : resolverAgents.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground/70">
                No agents yet. Spawn one below.
              </p>
            ) : null
          ) : (
            <ul className="flex flex-col gap-1 pl-2">
              {sorted.filter((r) => !resolverIds.has(r.id)).map(renderAdHocRow)}
            </ul>
          )}
          <SpawnAgentControl sessionId={task.id} />
          {spawnError ? <p className="mt-1 px-2 text-2xs text-danger">{spawnError}</p> : null}
        </>
      ) : (
        <CollapsedSummary
          text={
            standaloneAgentCount === 0 ? 'No agents yet' : pluralize(standaloneAgentCount, 'agent')
          }
        />
      )}
      <PlanReadySuggestion task={task} />

      <ScriptsSection
        sessionId={task.id}
        workspaceId={task.workspaceId}
        worktreePath={worktreePath}
      />

      {resolverAgents.length > 0 && (
        <>
          <SectionHeader
            className="mt-6 pb-1.5"
            icon={<CheckCheck size={11} aria-hidden className="text-lime-500" />}
            label="Resolve"
          />
          <ResolveCluster
            agents={resolverAgents}
            sessionId={task.id}
            isTaskActive={isTaskActive}
            prNumber={prNumber}
            resolvedThreadIds={resolvedThreadIds}
            pendingThreadIds={pendingThreadIds}
            resolverState={resolverState}
            selectedAgentId={selectedAgentId}
            expanded={resolveExpanded}
            onToggle={() => setResolveExpanded((v) => !v)}
            onSelect={onPickAgent}
            onForceNext={() => void activateNextResolver(task.id)}
          />
        </>
      )}
    </section>
  );
}
