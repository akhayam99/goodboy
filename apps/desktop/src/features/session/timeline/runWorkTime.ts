import type { AgentId, EffortLevel, ProviderId, RoleModelPreferences } from '@goodboy/types';
import type { RowPhase } from '../../workTreeModel/rowState';
import { workTime, type WorkEstimate, type WorkTime } from '../../workTreeModel/workTime';
import { familyActiveTime, type WorkTimeSource } from '../../workTreeModel/workTimeSource';
import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';
import { stepWorkEstimate } from './stepWorkEstimate';

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
  readonly lowMs: number;
  readonly midMs: number;
  readonly highMs: number;
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
      bands.push({ lowMs: activeMs, midMs: activeMs, highMs: activeMs, isFallback: false });
      continue;
    }
    const estimate = stepWorkEstimate({
      step,
      agent,
      kind: child?.agentKind ?? null,
      source,
      roleModels,
      sessionProvider,
      sessionEffort,
    });
    if (estimate === null) {
      return null;
    }
    const activeMs = active?.activeMs ?? 0;
    bands.push({
      lowMs: Math.max(activeMs, estimate.lowMs),
      midMs: Math.max(activeMs, estimate.midMs),
      highMs: Math.max(activeMs, estimate.highMs),
      isFallback: estimate.isFallback,
    });
  }
  if (bands.length === 0) {
    return null;
  }
  return {
    lowMs: bands.reduce((total, band) => total + band.lowMs, 0),
    midMs: bands.reduce((total, band) => total + band.midMs, 0),
    highMs: bands.reduce((total, band) => total + band.highMs, 0),
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
