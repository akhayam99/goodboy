import { estimateOrchestratedRun, isAgentStatusSettled } from '@goodboy/core';
import type {
  Agent,
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  Step,
  WorkflowRun,
} from '@goodboy/types';
import { timeLeftLabel, usualRangeLabel } from '../../workTreeModel/workTime';
import { familyActiveTime, type WorkTimeSource } from '../../workTreeModel/workTimeSource';
import { stepWorkEstimate } from './stepWorkEstimate';

export type RunTimeLeft = {
  readonly label: string;
  readonly detail: string;
};

type Params = {
  readonly run: WorkflowRun;
  readonly steps: ReadonlyArray<Step>;
  readonly agents: ReadonlyArray<Agent>;
  readonly source: WorkTimeSource;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
};

const MACHINE_TIME_NOTE = 'Waiting on you is not counted.';

type Remaining = {
  readonly lowMs: number;
  readonly highMs: number;
  readonly part: string;
  readonly hasStarted: boolean;
};

const orchestratedTimeLeft = ({ agents, source }: Params): RunTimeLeft | null => {
  if (source.history === null) {
    return null;
  }
  const estimate = estimateOrchestratedRun({
    runs: source.history.orchestratedRuns,
    nowMs: source.nowMs,
  });
  if (estimate === null) {
    return null;
  }
  const activeMs = familyActiveTime({ agentIds: agents.map((agent) => agent.id), source }).activeMs;
  if (activeMs > estimate.highMs) {
    return null;
  }
  const usual = usualRangeLabel(estimate);
  const runs = `${estimate.sampleCount} past orchestrated ${estimate.sampleCount === 1 ? 'run' : 'runs'}`;
  return {
    label: timeLeftLabel({
      lowMs: Math.max(0, estimate.lowMs - activeMs),
      highMs: estimate.highMs - activeMs,
    }),
    detail: `Usually ${usual} in total. Based on ${runs} in this workspace, last 90 days. ${MACHINE_TIME_NOTE}`,
  };
};

const stepsTimeLeft = ({
  steps,
  agents,
  source,
  roleModels,
  sessionProvider,
  sessionEffort,
}: Params): RunTimeLeft | null => {
  if (source.history === null) {
    return null;
  }
  const remaining: Array<Remaining> = [];
  const live = steps.filter((step) => step.deletedAt == null);
  for (const [index, step] of live.entries()) {
    const agent =
      agents.find((candidate) => candidate.stepId === step.id && candidate.parentAgentId == null) ??
      null;
    if (agent !== null && isAgentStatusSettled({ status: agent.status })) {
      continue;
    }
    const estimate = stepWorkEstimate({
      step,
      agent,
      kind: null,
      source,
      roleModels,
      sessionProvider,
      sessionEffort,
    });
    if (estimate === null) {
      return null;
    }
    const activeMs =
      agent === null ? 0 : familyActiveTime({ agentIds: [agent.id], source }).activeMs;
    if (activeMs > estimate.highMs) {
      return null;
    }
    const lowMs = Math.max(0, estimate.lowMs - activeMs);
    const highMs = estimate.highMs - activeMs;
    remaining.push({
      lowMs,
      highMs,
      hasStarted: activeMs > 0,
      part:
        activeMs > 0
          ? `step ${index + 1} ${timeLeftLabel({ lowMs, highMs })}`
          : `step ${index + 1} usually ${usualRangeLabel(estimate)}`,
    });
  }
  if (remaining.length === 0) {
    return null;
  }
  const sentence = remaining.map((entry) => entry.part).join(', then ');
  const lowMs = remaining.reduce((total, entry) => total + entry.lowMs, 0);
  const highMs = remaining.reduce((total, entry) => total + entry.highMs, 0);
  const hasStarted = remaining.some((entry) => entry.hasStarted);
  return {
    label: hasStarted
      ? timeLeftLabel({ lowMs, highMs })
      : `usually ${usualRangeLabel({ lowMs, midMs: (lowMs + highMs) / 2, highMs })}`,
    detail: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. ${MACHINE_TIME_NOTE}`,
  };
};

export const runTimeLeft = (params: Params): RunTimeLeft | null =>
  params.run.executionMode === 'dynamic' ? orchestratedTimeLeft(params) : stepsTimeLeft(params);
