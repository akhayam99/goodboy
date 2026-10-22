import type { Agent } from '@goodboy/types';
import { autoGroupOf, type AutoGroupChild } from '../../../auto/autoGroupOf';
import { agentWorkTime, estimateKeyOf } from '../../../workTreeModel/agentWorkTime';
import type { WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { AGENT_KIND_META, KIND_TO_ROLE } from '../../agent-kind';
import type {
  TimelineAgentEntry,
  TimelineEventEntry,
  TimelineRunEntry,
} from '../../timeline/buildTimelineGroups';
import { dayLabel } from '../../timeline/dayLabel';
import { agentRanModels, modelsSummary, runRanModels } from '../../timeline/ranModels';
import { runWorkTime } from '../../timeline/runWorkTime';
import { historyBatchByEventIdOf, type HistoryBatch } from '../../timeline/historyBatchesOf';
import { batchDoneRowsOf } from './batchDoneRowsOf';
import { isEventOwnedByRow } from './isEventOwnedByRow';
import type {
  DoneBranchLine,
  DoneCosts,
  DoneDay,
  DoneDetail,
  DoneModel,
  DoneRowModel,
  DoneStepLine,
} from './doneTypes';
import { firstSentenceOf } from './firstSentenceOf';
import { fullTextOf } from './fullTextOf';
import { isRunEntryFinished, outcomeLineOf } from './outcomeLineOf';

type Params = {
  readonly model: DoneModel;
  readonly source: WorkTimeSource | null;
  readonly costs: DoneCosts;
};

type Context = Params & {
  readonly batchByEventId: ReadonlyMap<string, HistoryBatch>;
  readonly foldedRows: ReadonlyMap<string, DoneRowModel | null>;
};

const FINISHED_TREE_PHASES: ReadonlySet<string> = new Set(['done', 'finished']);

const NO_STEPS: ReadonlyArray<DoneStepLine> = [];

const NO_BRANCHES: ReadonlyArray<DoneBranchLine> = [];

const EMPTY_DETAIL: DoneDetail = {
  model: null,
  effort: null,
  duration: null,
  costUsd: null,
  fullText: null,
  steps: NO_STEPS,
  auto: null,
  branches: NO_BRANCHES,
};

type ValueParams = {
  readonly value: number | undefined;
};

type AgentParams = {
  readonly agent: Agent;
};

type AtParams = {
  readonly at: string;
};

type EventParams = {
  readonly entry: TimelineEventEntry;
};

const positive = ({ value }: ValueParams): number | null =>
  value !== undefined && value > 0 ? value : null;

const newestOf = ({
  values,
}: {
  readonly values: ReadonlyArray<string | undefined>;
}): string | null =>
  values
    .filter((value): value is string => value !== undefined)
    .sort((first, second) => first.localeCompare(second))
    .at(-1) ?? null;

const agentAtOf = ({
  agent,
  fallback,
}: {
  readonly agent: Agent;
  readonly fallback: string | null;
}) => newestOf({ values: [agent.completedAt, agent.lastFinishedAt] }) ?? fallback;

const isAgentDone = ({ agent }: AgentParams): boolean =>
  agent.status === 'completed' && agent.deletedAt === undefined;

type AgentModelParams = {
  readonly agent: Agent;
  readonly source: WorkTimeSource | null;
};

const agentModelOf = ({
  agent,
  source,
}: AgentModelParams): { readonly model: string | null; readonly effort: string | null } => {
  if (source === null) {
    return { model: null, effort: null };
  }
  const { models } = agentRanModels({
    spans: source.spans,
    agentId: agent.id,
    routing: null,
    isRoutingPlanned: false,
    isLive: false,
  });
  const last = models.at(-1);
  return { model: last?.name ?? null, effort: last?.effort ?? null };
};

type AgentDurationParams = AgentModelParams & {
  readonly kind: TimelineAgentEntry['agentKind'];
};

const agentDurationOf = ({ agent, kind, source }: AgentDurationParams): string | null => {
  if (source === null) {
    return null;
  }
  const label = agentWorkTime({
    agentId: agent.id,
    key: estimateKeyOf({
      role: KIND_TO_ROLE[kind],
      provider: null,
      model: null,
      effort: null,
      size: null,
    }),
    unit: 'turn',
    phase: 'done',
    source,
  })?.label;
  return label === undefined || label === '' ? null : label;
};

const stepLineOf = ({
  step,
  source,
}: {
  readonly step: TimelineAgentEntry;
  readonly source: WorkTimeSource | null;
}): DoneStepLine => {
  const { model, effort } = agentModelOf({ agent: step.agent, source });
  return {
    id: step.agent.id,
    title: firstSentenceOf({ text: step.agent.outputSummary }) ?? step.agent.name,
    role: AGENT_KIND_META[step.agentKind].noun,
    model,
    effort,
    duration: agentDurationOf({ agent: step.agent, kind: step.agentKind, source }),
  };
};

const agentRowOf = ({
  entry,
  context,
}: {
  readonly entry: TimelineAgentEntry;
  readonly context: Context;
}): DoneRowModel | null => {
  const { model, source, costs } = context;
  const view = model.autoTrees.find((candidate) => candidate.tree.rootAgentId === entry.agent.id);
  const isFinished =
    view === undefined
      ? isAgentDone({ agent: entry.agent })
      : FINISHED_TREE_PHASES.has(view.tree.phase);
  if (!isFinished) {
    return null;
  }
  const at = agentAtOf({ agent: entry.agent, fallback: entry.at });
  if (at === null) {
    return null;
  }
  const line = outcomeLineOf({ entry, model });
  const ran = agentModelOf({ agent: entry.agent, source });
  const auto =
    view === undefined ? null : autoGroupOf({ view, agents: model.agents, now: model.now });
  return {
    id: entry.id,
    entryId: entry.id,
    ...line,
    at,
    mountId: entry.agent.mountId ?? null,
    retryAgentId: null,
    detail: {
      ...ran,
      duration: agentDurationOf({ agent: entry.agent, kind: entry.agentKind, source }),
      costUsd:
        view?.budget === null || view?.budget === undefined
          ? positive({ value: costs.byAgentId.get(entry.agent.id) })
          : positive({ value: view.budget.spentUsd }),
      fullText: fullTextOf({ text: entry.agent.outputSummary, title: line.title }),
      steps: NO_STEPS,
      auto,
      branches: NO_BRANCHES,
    },
  };
};

const mountOfSteps = ({
  steps,
}: {
  readonly steps: ReadonlyArray<TimelineAgentEntry>;
}): string | null => {
  const mounts = new Set(steps.map((step) => step.agent.mountId ?? null));
  const [only] = Array.from(mounts);
  return mounts.size === 1 && only !== undefined ? only : null;
};

const dayKeyOf = ({ at }: AtParams): string => new Date(at).toDateString();

type RunRowParams = {
  readonly entry: TimelineRunEntry;
  readonly slice: ReadonlyArray<TimelineAgentEntry> | null;
  readonly steps: ReadonlyArray<TimelineAgentEntry>;
  readonly context: Context;
};

const runRowOf = ({ entry, slice, steps, context }: RunRowParams): DoneRowModel | null => {
  const { model, source, costs } = context;
  const shown = slice ?? steps;
  const at = newestOf({
    values: shown.map((step) => agentAtOf({ agent: step.agent, fallback: step.at }) ?? undefined),
  });
  if (at === null) {
    return null;
  }
  const line = outcomeLineOf({ entry, model, slice });
  const time =
    source === null
      ? undefined
      : runWorkTime({
          entry: { ...entry, children: shown },
          phase: 'done',
          source,
          roleModels: null,
          sessionProvider: null,
          sessionEffort: null,
        })?.label;
  const summary =
    source === null || slice !== null
      ? null
      : modelsSummary({
          models: runRanModels({ spans: source.spans, runId: entry.run.id }),
          isRun: true,
        });
  const cost =
    slice === null
      ? positive({ value: costs.byRunId.get(entry.run.id) })
      : positive({
          value: slice.reduce((sum, step) => sum + (costs.byAgentId.get(step.agent.id) ?? 0), 0),
        });
  return {
    id: slice === null ? entry.id : `${entry.id}:${dayKeyOf({ at })}`,
    entryId: entry.id,
    ...line,
    at,
    mountId: mountOfSteps({ steps: shown }),
    retryAgentId: null,
    detail: {
      model: summary?.name ?? null,
      effort: null,
      duration: time === undefined || time === '' ? null : time,
      costUsd: cost,
      fullText: null,
      steps: [...shown]
        .sort((first, second) => first.agent.ordinal - second.agent.ordinal)
        .map((step) => stepLineOf({ step, source })),
      auto: null,
      branches: NO_BRANCHES,
    },
  };
};

const runRowsOf = ({
  entry,
  context,
}: {
  readonly entry: TimelineRunEntry;
  readonly context: Context;
}): ReadonlyArray<DoneRowModel> => {
  const steps = entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : []));
  if (isRunEntryFinished({ entry })) {
    const row = runRowOf({ entry, slice: null, steps, context });
    return row === null ? [] : [row];
  }
  const finished = steps.filter((step) => isAgentDone({ agent: step.agent }));
  const byDay = new Map<string, Array<TimelineAgentEntry>>();
  for (const step of finished) {
    const at = agentAtOf({ agent: step.agent, fallback: step.at });
    if (at === null) {
      continue;
    }
    const key = dayKeyOf({ at });
    byDay.set(key, [...(byDay.get(key) ?? []), step]);
  }
  return Array.from(byDay.values()).flatMap((slice) => {
    const row = runRowOf({ entry, slice, steps, context });
    return row === null ? [] : [row];
  });
};

const isRebaseEvent = ({ entry }: EventParams): boolean =>
  entry.event.kind === 'history_rewritten' && entry.event.payload?.origin === 'rebase';

const eventRowOf = ({
  entry,
  context,
}: {
  readonly entry: TimelineEventEntry;
  readonly context: Context;
}): DoneRowModel | null => {
  if (!isRebaseEvent({ entry })) {
    return null;
  }
  const folded = context.foldedRows.get(entry.event.id);
  if (folded !== undefined) {
    return folded;
  }
  if (isEventOwnedByRow({ event: entry.event, model: context.model })) {
    return null;
  }
  return {
    id: entry.id,
    entryId: context.batchByEventId.get(entry.event.id)?.entryId ?? entry.id,
    ...outcomeLineOf({ entry, model: context.model }),
    at: entry.event.createdAt,
    mountId: entry.event.payload?.mountId ?? null,
    retryAgentId: null,
    detail: EMPTY_DETAIL,
  };
};

type ChildParams = {
  readonly child: AutoGroupChild;
};

const stoppedTitleOf = ({ child }: ChildParams): string =>
  `You ${child.reasonCode === 'declined' ? 'declined' : 'stopped'} the ${child.noun.toLowerCase()}`;

type ModelParams = {
  readonly model: DoneModel;
};

const stoppedChildRowsOf = ({ model }: ModelParams): ReadonlyArray<DoneRowModel> =>
  model.autoTrees
    .filter((view) => !FINISHED_TREE_PHASES.has(view.tree.phase))
    .flatMap((view) => {
      const group = autoGroupOf({ view, agents: model.agents, now: model.now });
      const rootEntry = model.entries.find(
        (entry) => entry.kind === 'agent' && entry.agent.id === view.tree.rootAgentId,
      );
      return (group?.children ?? []).flatMap((child): ReadonlyArray<DoneRowModel> => {
        if (child.state !== 'stopped' || child.finishedAt === null) {
          return [];
        }
        const id = `auto-stopped:${child.agentId}`;
        return [
          {
            id,
            entryId: rootEntry?.id ?? id,
            title: stoppedTitleOf({ child }),
            by: 'Auto',
            at: new Date(child.finishedAt).toISOString(),
            mountId: child.mountId,
            retryAgentId: child.agentId,
            detail: EMPTY_DETAIL,
          },
        ];
      });
    });

export const doneRowsOf = ({ model, source, costs }: Params): ReadonlyArray<DoneDay> => {
  const batchByEventId = historyBatchByEventIdOf({ events: model.events });
  const context: Context = {
    model,
    source,
    costs,
    batchByEventId,
    foldedRows: batchDoneRowsOf({ model, batchByEventId }),
  };
  const rows = [
    ...stoppedChildRowsOf({ model }),
    ...model.entries.flatMap((entry): ReadonlyArray<DoneRowModel> => {
      switch (entry.kind) {
        case 'agent': {
          const row = agentRowOf({ entry, context });
          return row === null ? [] : [row];
        }
        case 'run':
          return runRowsOf({ entry, context });
        case 'event': {
          const row = eventRowOf({ entry, context });
          return row === null ? [] : [row];
        }
        case 'plan':
        case 'artifact':
        case 'issue':
        case 'branch':
        case 'learning':
        case 'question':
          return [];
        default: {
          const exhaustive: never = entry;
          return exhaustive;
        }
      }
    }),
  ].sort((first, second) => second.at.localeCompare(first.at));
  const days: Array<DoneDay> = [];
  for (const row of rows) {
    const key = dayKeyOf({ at: row.at });
    const last = days[days.length - 1];
    if (last !== undefined && last.key === key) {
      days[days.length - 1] = { ...last, rows: [...last.rows, row] };
      continue;
    }
    days.push({ key, label: dayLabel({ at: row.at, now: new Date(model.now) }), rows: [row] });
  }
  return days;
};
