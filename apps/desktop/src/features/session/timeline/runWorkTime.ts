import type { AgentId, EffortLevel, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { estimateKeyOf, workEstimateFor } from '../../workTreeModel/agentWorkTime';
import type { RowPhase } from '../../workTreeModel/rowState';
import { workTime, type WorkEstimate, type WorkTime } from '../../workTreeModel/workTime';
import { familyActiveTime, type WorkTimeSource } from '../../workTreeModel/workTimeSource';
import { KIND_TO_ROLE, kindForRole } from '../agent-kind';
import { agentRowRouting } from './agentRowRouting';
import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';

type Params = {
  readonly entry: TimelineRunEntry;
  readonly phase: RowPhase;
  readonly source: WorkTimeSource;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
};

const RUN_BASIS =
  'Adds what finished steps took to the usual time of the steps left. Machine time only.';

const agentsOf = ({
  entries,
}: {
  readonly entries: ReadonlyArray<TimelineAgentEntry>;
}): ReadonlyArray<AgentId> =>
  entries.flatMap((entry) => [entry.agent.id, ...agentsOf({ entries: entry.children })]);

type Band = {
  readonly p25Ms: number;
  readonly p50Ms: number;
  readonly p75Ms: number;
  readonly isFallback: boolean;
};

const runEstimate = ({
  entry,
  source,
  roleModels,
  sessionProvider,
  sessionEffort,
}: Omit<Params, 'phase'>): WorkEstimate | null => {
  if (entry.run.executionMode === 'dynamic') {
    return null;
  }
  const stepAgents = entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));
  const bands: Array<Band> = [];
  for (const step of entry.workflow.steps) {
    if (step.deletedAt != null) {
      continue;
    }
    const child = stepAgents.find((candidate) => candidate.agent.stepId === step.id) ?? null;
    const agent = child?.agent ?? null;
    if (agent?.status === 'skipped') {
      continue;
    }
    const active =
      child === null
        ? null
        : familyActiveTime({ agentIds: agentsOf({ entries: [child] }), source });
    if (agent?.status === 'completed') {
      const activeMs = active?.activeMs ?? 0;
      bands.push({ p25Ms: activeMs, p50Ms: activeMs, p75Ms: activeMs, isFallback: false });
      continue;
    }
    const kind = child?.agentKind ?? kindForRole({ role: step.role ?? 'custom' });
    const routing = agentRowRouting({
      executed: null,
      step,
      kind,
      roleModels,
      providerOverride: agent?.providerOverride ?? null,
      modelOverride: agent?.modelOverride ?? null,
      effortOverride: agent?.effort ?? null,
      sessionProvider,
      sessionEffort,
    });
    const estimate = workEstimateFor({
      key: estimateKeyOf({
        role: step.role ?? KIND_TO_ROLE[kind],
        provider: routing.provider,
        model: routing.model,
        effort: routing.effort,
      }),
      source,
    });
    if (estimate === null) {
      return null;
    }
    const activeMs = active?.activeMs ?? 0;
    bands.push({
      p25Ms: Math.max(activeMs, estimate.p25Ms),
      p50Ms: Math.max(activeMs, estimate.p50Ms),
      p75Ms: Math.max(activeMs, estimate.p75Ms),
      isFallback: estimate.isFallback,
    });
  }
  if (bands.length === 0) {
    return null;
  }
  return {
    p25Ms: bands.reduce((total, band) => total + band.p25Ms, 0),
    p50Ms: bands.reduce((total, band) => total + band.p50Ms, 0),
    p75Ms: bands.reduce((total, band) => total + band.p75Ms, 0),
    isFallback: bands.some((band) => band.isFallback),
    basis: RUN_BASIS,
  };
};

export const runWorkTime = (params: Params): WorkTime | null => {
  const { entry, phase, source } = params;
  const agents = entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));
  const active = familyActiveTime({ agentIds: agentsOf({ entries: agents }), source });
  const isFinished = phase === 'done' || phase === 'closed' || phase === 'failed';
  return workTime({
    phase,
    activeMs: active.activeMs,
    hasStarted: active.hasStarted,
    estimate: isFinished || source.history === null ? null : runEstimate(params),
    unknownBasis: null,
  });
};
