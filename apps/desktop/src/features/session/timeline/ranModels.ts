import {
  PROVIDER_IDS,
  type AgentId,
  type AgentTurnSpanEndReason,
  type MeasuredTurnSpan,
  type ProviderId,
  type WorkflowRunId,
} from '@goodboy/types';
import { PROVIDER_LABEL } from '../../providers/providerLabel';
import { routingLabelModel } from '../../../shared/components/RoutingLabel/routingLabelModel';
import { routingNameText } from '../../../shared/components/RoutingPicker/routingSummary';
import { EFFORT_LABEL, EFFORT_LEVELS } from '../../chat/utils/chat-constants';

export type RanModel = {
  readonly key: string;
  readonly provider: ProviderId | null;
  readonly name: string;
  readonly effort: string | null;
  readonly endReason: AgentTurnSpanEndReason | null;
  readonly endedAtMs: number | null;
};

export type RunModel = {
  readonly key: string;
  readonly provider: ProviderId | null;
  readonly name: string;
  readonly stepCount: number;
  readonly costUsd: number;
};

export type ModelsSummary = {
  readonly text: string;
  readonly providers: ReadonlyArray<ProviderId>;
};

export type AgentModels = {
  readonly models: ReadonlyArray<RanModel>;
  readonly isPlanned: boolean;
};

type RouteParams = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
};

type Route = Pick<RanModel, 'key' | 'provider' | 'name' | 'effort'>;

const routeOf = ({ provider, model, effort }: RouteParams): Route | null => {
  if (model == null) {
    const named = PROVIDER_IDS.find((candidate) => candidate === provider);
    if (named === undefined) {
      return null;
    }
    return { key: `${named}:`, provider: named, name: PROVIDER_LABEL[named], effort: null };
  }
  const shown = routingLabelModel({
    provider,
    model,
    effort,
    planned: null,
    isEffortObserved: true,
  });
  if (shown.label == null) {
    return null;
  }
  const name = routingNameText(shown.label);
  const level = EFFORT_LEVELS.find((candidate) => candidate === effort) ?? null;
  return {
    key: `${shown.provider ?? provider ?? ''}:${name}`,
    provider: shown.provider,
    name,
    effort: level === null ? null : EFFORT_LABEL[level],
  };
};

type AgentParams = {
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly agentId: AgentId;
  readonly routing: RouteParams | null;
  readonly isRoutingPlanned: boolean;
  readonly isLive: boolean;
};

export const agentRanModels = ({
  spans,
  agentId,
  routing,
  isRoutingPlanned,
  isLive,
}: AgentParams): AgentModels => {
  const own = spans
    .filter((span) => span.agentId === agentId)
    .sort((left, right) => left.startedAtMs - right.startedAtMs);
  const ran: Array<RanModel> = [];
  for (const span of own) {
    const route = routeOf(span);
    if (route === null) {
      continue;
    }
    const next: RanModel = { ...route, endReason: span.endReason, endedAtMs: span.endedAtMs };
    const last = ran[ran.length - 1];
    if (last !== undefined && last.key === route.key) {
      ran[ran.length - 1] = next;
      continue;
    }
    ran.push(next);
  }
  const current = routing === null ? null : routeOf(routing);
  if (current === null) {
    return { models: ran, isPlanned: false };
  }
  const running: RanModel = { ...current, endReason: null, endedAtMs: null };
  if (ran.length === 0) {
    return { models: [running], isPlanned: isRoutingPlanned };
  }
  if (!isLive) {
    return { models: ran, isPlanned: false };
  }
  const last = ran[ran.length - 1];
  if (last !== undefined && last.key === current.key) {
    ran[ran.length - 1] = running;
    return { models: ran, isPlanned: false };
  }
  return { models: [...ran, running], isPlanned: false };
};

type RunParams = {
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly runId: WorkflowRunId;
};

type RunAccumulator = {
  readonly route: Route;
  readonly steps: Set<AgentId>;
  costUsd: number;
};

export const runRanModels = ({ spans, runId }: RunParams): ReadonlyArray<RunModel> => {
  const ordered = spans
    .filter((span) => span.workflowRunId === runId)
    .sort((left, right) => left.startedAtMs - right.startedAtMs);
  const byKey = new Map<string, RunAccumulator>();
  for (const span of ordered) {
    const route = routeOf(span);
    if (route === null) {
      continue;
    }
    const known = byKey.get(route.key) ?? { route, steps: new Set<AgentId>(), costUsd: 0 };
    known.steps.add(span.parentAgentId ?? span.agentId);
    known.costUsd += span.costUsd ?? 0;
    byKey.set(route.key, known);
  }
  return Array.from(byKey.values(), ({ route, steps, costUsd }) => ({
    key: route.key,
    provider: route.provider,
    name: route.name,
    stepCount: steps.size,
    costUsd,
  }));
};

type SummaryModel = Pick<RanModel, 'key' | 'provider' | 'name'>;

type SummaryParams = {
  readonly models: ReadonlyArray<SummaryModel>;
  readonly isRun?: boolean;
};

export const modelsSummary = ({ models, isRun = false }: SummaryParams): ModelsSummary | null => {
  const distinct = new Map<string, SummaryModel>();
  for (const model of models) {
    if (!distinct.has(model.key)) {
      distinct.set(model.key, model);
    }
  }
  const list = Array.from(distinct.values());
  const first = list[0];
  if (first === undefined) {
    return null;
  }
  const providers: Array<ProviderId> = [];
  for (const model of list) {
    if (model.provider !== null && !providers.includes(model.provider)) {
      providers.push(model.provider);
    }
  }
  if (isRun) {
    return {
      text: list.length === 1 ? first.name : `${first.name} + ${list.length - 1}`,
      providers,
    };
  }
  if (list.length === 1) {
    return { text: first.name, providers };
  }
  if (list.length === 2) {
    return { text: list.map((model) => model.name).join(' → '), providers };
  }
  return { text: `${list.length} models`, providers };
};
