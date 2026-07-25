import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Agent,
  AgentId,
  Session,
  SessionId,
  SessionStage,
  TelemetryRecord,
  Workflow,
  WorkspaceId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, agentHasUnread } from '../../../../store';
import { deriveSessionStage, isPrReviewSession } from '../../../../store/slices/session-view';
import { inferAgentKindFromName, type AgentKind } from '../../../session/agent-kind';
import {
  statusToNodeStatus,
  type SpawnNode,
  type SpawnNodeStatus,
} from '../../components/SpawnTree/lib';

export type StepModel = {
  readonly stepId: string;
  readonly name: string;
  readonly kind: AgentKind;
  readonly status: SpawnNodeStatus;
  readonly rootAgentId: AgentId | null;
  readonly children: ReadonlyArray<SpawnNode>;
};

export type RunLaneModel = {
  readonly runId: string;
  readonly workflowName: string;
  readonly sessionId: SessionId;
  readonly sessionGoal: string;
  readonly stage: SessionStage;
  readonly autoRun: boolean;
  readonly chainAfterId: string | null;
  readonly steps: ReadonlyArray<StepModel>;
  readonly costUsd: number;
};

export type RunsAggregate = {
  readonly runCount: number;
  readonly agentCount: number;
  readonly runningCount: number;
  readonly stalledCount: number;
  readonly spendUsd: number;
};

export type WorkspaceRuns = {
  readonly lanes: RunLaneModel[];
  readonly freeAgents: SpawnNode[];
  readonly resolveQueue: SpawnNode[];
  readonly aggregate: RunsAggregate;
  readonly completedLanes?: RunLaneModel[];
  readonly completedFreeAgents?: SpawnNode[];
  readonly completedResolveQueue?: SpawnNode[];
};

const isRunningOrPending = (status: SpawnNodeStatus): boolean =>
  status === 'running' || status === 'queued' || status === 'planned';

type CostByAgentId = ReadonlyMap<string, number>;

const kindOf = (agent: Agent): AgentKind =>
  agent.kind != null ? (agent.kind as AgentKind) : inferAgentKindFromName(agent.name);

const stepKind = (workflow: Workflow, stepId: string): AgentKind => {
  const step = workflow.steps.find((s) => s.id === stepId);
  return step ? inferAgentKindFromName(step.name) : 'generic';
};

const buildCostByAgentId = (
  phaseRuns: ReadonlyArray<Agent>,
  telemetry: ReadonlyArray<TelemetryRecord>,
  agentRunHistory: Readonly<Record<string, ReadonlyArray<string>>>,
): CostByAgentId => {
  const latestByRun = new Map<string, TelemetryRecord>();
  for (const rec of telemetry) {
    if (rec.kind !== 'turn') {
      continue;
    }
    const existing = latestByRun.get(rec.runId);
    if (!existing || existing.recordedAt < rec.recordedAt) {
      latestByRun.set(rec.runId, rec);
    }
  }
  const self = new Map<string, number>();
  for (const run of phaseRuns) {
    const runIds = agentRunHistory[run.id] ?? (run.runId ? [run.runId] : []);
    let cost = 0;
    for (const rid of runIds) {
      const rec = latestByRun.get(rid);
      if (rec) {
        cost += rec.estimatedCostUsd;
      }
    }
    self.set(run.id, cost);
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
  const rolled = new Map<string, number>();
  const rollup = (id: string): number => {
    const cached = rolled.get(id);
    if (cached != null) {
      return cached;
    }
    let total = self.get(id) ?? 0;
    for (const cid of childIds.get(id) ?? []) {
      total += rollup(cid);
    }
    rolled.set(id, total);
    return total;
  };
  for (const run of phaseRuns) {
    rollup(run.id);
  }
  return rolled;
};

const agentToNode = (
  agent: Agent,
  childrenByParentId: ReadonlyMap<string, Agent[]>,
  costByAgentId: CostByAgentId,
  selectedAgentId: AgentId | null,
  depth: number,
): SpawnNode => {
  const kids = depth < 6 ? (childrenByParentId.get(agent.id) ?? EMPTY_ARRAY) : EMPTY_ARRAY;
  const children = [...kids]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((c) => agentToNode(c, childrenByParentId, costByAgentId, selectedAgentId, depth + 1));
  return {
    id: agent.id,
    name: agent.name,
    kind: kindOf(agent),
    status: statusToNodeStatus(agent.status),
    costUsd: costByAgentId.get(agent.id) ?? 0,
    outputSummary: agent.outputSummary ?? null,
    children,
    isSelected: agent.id === selectedAgentId,
  };
};

const stepStatus = (root: Agent | null): SpawnNodeStatus =>
  root ? statusToNodeStatus(root.status) : 'planned';

export const useWorkspaceRuns = (
  workspaceId: WorkspaceId,
  sessions: ReadonlyArray<Session>,
): WorkspaceRuns => {
  const sessionIds = useMemo(
    () => sessions.filter((s) => s.workspaceId === workspaceId).map((s) => s.id as SessionId),
    [sessions, workspaceId],
  );

  const phaseRunsBySession = useAppStore(
    useShallow((s) => {
      const out: Record<string, ReadonlyArray<Agent>> = {};
      for (const id of sessionIds) {
        out[id] = s.sessionPhaseRuns[id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>);
      }
      return out;
    }),
  );
  const telemetryBySession = useAppStore(
    useShallow((s) => {
      const out: Record<string, ReadonlyArray<TelemetryRecord>> = {};
      for (const id of sessionIds) {
        out[id] = s.sessionTelemetry[id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>);
      }
      return out;
    }),
  );
  const agentRunHistory = useAppStore((s) => s.agentRunHistory);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const selectedAgentIdBySession = useAppStore(
    useShallow((s) => {
      const out: Record<string, AgentId | null> = {};
      for (const id of sessionIds) {
        out[id] = (s.selectedAgentId[id] ?? null) as AgentId | null;
      }
      return out;
    }),
  );
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const stageBySession = useAppStore(
    useShallow((s) => {
      const out: Record<string, SessionStage> = {};
      for (const session of sessions) {
        if (session.workspaceId !== workspaceId) {
          continue;
        }
        const id = session.id as SessionId;
        const runs = s.sessionPhaseRuns[id];
        const selected = s.selectedAgentId[id] ?? null;
        const isCurrent = s.currentSessionId === id;
        const hasUnread = runs
          ? runs.some((r) => agentHasUnread(r, isCurrent && r.id === selected))
          : false;
        const hasRunningAgent = runs ? runs.some((r) => r.status === 'running') : false;
        const openQuestionCount = (s.sessionOpenQuestions[id] ?? []).filter(
          (q) => q.status === 'open',
        ).length;
        out[id] = deriveSessionStage({
          session,
          pr: s.sessionGithub[id]?.pr ?? null,
          hasUnread,
          openQuestionCount,
          hasRunningAgent,
          isPrReview: isPrReviewSession({ agents: runs ?? [] }),
        }).stage;
      }
      return out;
    }),
  );

  return useMemo(() => {
    const workflowById = new Map<string, Workflow>();
    for (const w of phaseTemplates) {
      workflowById.set(w.id, w);
    }

    const activeLanes: RunLaneModel[] = [];
    const completedLanes: RunLaneModel[] = [];
    const activeFreeAgents: SpawnNode[] = [];
    const completedFreeAgents: SpawnNode[] = [];
    const activeResolveQueue: SpawnNode[] = [];
    const completedResolveQueue: SpawnNode[] = [];

    let runningCount = 0;
    let stalledCount = 0;
    let agentCount = 0;
    let spendUsd = 0;

    for (const session of sessions) {
      if (session.workspaceId !== workspaceId) {
        continue;
      }
      const sid = session.id as SessionId;
      const phaseRuns = phaseRunsBySession[sid] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>);
      const telemetry = telemetryBySession[sid] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>);
      const selectedAgentId = selectedAgentIdBySession[sid] ?? null;
      const stage = stageBySession[sid] ?? 'building';

      for (const rec of telemetry) {
        if (rec.kind === 'summarizer') {
          continue;
        }
        spendUsd += rec.estimatedCostUsd;
      }

      const withKind = phaseRuns.map((agent) => {
        const override = agentKindOverride[agent.id];
        return override ? { ...agent, kind: override } : agent;
      });

      const childrenByParentId = new Map<string, Agent[]>();
      for (const agent of withKind) {
        if (agent.parentAgentId == null) {
          continue;
        }
        const bucket = childrenByParentId.get(agent.parentAgentId) ?? [];
        bucket.push(agent);
        childrenByParentId.set(agent.parentAgentId, bucket);
      }
      const costByAgentId = buildCostByAgentId(withKind, telemetry, agentRunHistory);

      for (const agent of withKind) {
        if (agent.status === 'running') {
          runningCount += 1;
        } else if (agent.status === 'failed') {
          stalledCount += 1;
        }
      }
      agentCount += withKind.length;

      const rootByRunStep = new Map<string, Agent>();
      const sortedRoots = [...withKind].sort((a, b) => a.ordinal - b.ordinal);
      for (const agent of sortedRoots) {
        if (agent.parentAgentId != null || agent.workflowRunId == null || agent.stepId == null) {
          continue;
        }
        const key = `${agent.workflowRunId}::${agent.stepId}`;
        if (!rootByRunStep.has(key)) {
          rootByRunStep.set(key, agent);
        }
      }

      const sortedRuns = [...session.workflowRuns]
        .filter((r) => r.discardedAt == null)
        .sort((a, b) => a.ordinal - b.ordinal);

      for (const run of sortedRuns) {
        const workflow = workflowById.get(run.workflowId);
        if (!workflow) {
          continue;
        }
        const steps: StepModel[] = workflow.steps
          .filter((step) => step.deletedAt == null)
          .slice()
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((step) => {
            const root = rootByRunStep.get(`${run.id}::${step.id}`) ?? null;
            const children = root
              ? [agentToNode(root, childrenByParentId, costByAgentId, selectedAgentId, 0)]
              : (EMPTY_ARRAY as ReadonlyArray<SpawnNode>);
            return {
              stepId: step.id,
              name: step.name,
              kind: root ? kindOf(root) : stepKind(workflow, step.id),
              status: stepStatus(root),
              rootAgentId: root ? root.id : null,
              children,
            };
          });
        const runCost = steps.reduce((sum, step) => {
          if (step.rootAgentId == null) {
            return sum;
          }
          return sum + (costByAgentId.get(step.rootAgentId) ?? 0);
        }, 0);
        const laneModel: RunLaneModel = {
          runId: run.id,
          workflowName: workflow.name,
          sessionId: sid,
          sessionGoal: session.goal,
          stage,
          autoRun: run.autoRun,
          chainAfterId: run.chainAfterId ?? null,
          steps,
          costUsd: runCost,
        };
        const laneIsActive = steps.some((step) => isRunningOrPending(step.status));
        if (laneIsActive) {
          activeLanes.push(laneModel);
        } else {
          completedLanes.push(laneModel);
        }
      }

      for (const agent of withKind) {
        if (agent.parentAgentId != null || agent.workflowRunId != null) {
          continue;
        }
        const node = agentToNode(agent, childrenByParentId, costByAgentId, selectedAgentId, 0);
        const nodeActive = isRunningOrPending(node.status);
        if (agent.sourceThreadId != null) {
          if (nodeActive) {
            activeResolveQueue.push(node);
          } else {
            completedResolveQueue.push(node);
          }
        } else {
          if (nodeActive) {
            activeFreeAgents.push(node);
          } else {
            completedFreeAgents.push(node);
          }
        }
      }
    }

    const aggregate: RunsAggregate = {
      runCount: activeLanes.length + completedLanes.length,
      agentCount,
      runningCount,
      stalledCount,
      spendUsd,
    };

    return {
      lanes: activeLanes,
      freeAgents: activeFreeAgents,
      resolveQueue: activeResolveQueue,
      aggregate,
      completedLanes,
      completedFreeAgents,
      completedResolveQueue,
    };
  }, [
    sessions,
    workspaceId,
    phaseRunsBySession,
    telemetryBySession,
    selectedAgentIdBySession,
    stageBySession,
    agentKindOverride,
    agentRunHistory,
    phaseTemplates,
  ]);
};
