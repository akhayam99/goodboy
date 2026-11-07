import type { Agent } from '@goodboy/types';
import { autoGroupOf, type AutoGroupChild } from '../../../auto/autoGroupOf';
import type {
  TimelineAgentEntry,
  TimelineEventEntry,
  TimelineRunEntry,
} from '../../timeline/buildTimelineGroups';
import { dayLabel } from '../../timeline/dayLabel';
import { historyBatchByEventIdOf, type HistoryBatch } from '../../timeline/historyBatchesOf';
import { batchDoneRowsOf } from './batchDoneRowsOf';
import { isEventOwnedByRow } from './isEventOwnedByRow';
import type { DoneDay, DoneModel, DoneRowModel } from './doneTypes';
import { isRunEntryFinished, outcomeLineOf } from './outcomeLineOf';

type Params = {
  readonly model: DoneModel;
};

type Context = Params & {
  readonly batchByEventId: ReadonlyMap<string, HistoryBatch>;
  readonly foldedRows: ReadonlyMap<string, DoneRowModel | null>;
};

const FINISHED_TREE_PHASES: ReadonlySet<string> = new Set(['done', 'finished']);

type AgentParams = {
  readonly agent: Agent;
};

type AtParams = {
  readonly at: string;
};

type EventParams = {
  readonly entry: TimelineEventEntry;
};

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

const agentRowOf = ({
  entry,
  context,
}: {
  readonly entry: TimelineAgentEntry;
  readonly context: Context;
}): DoneRowModel | null => {
  const { model } = context;
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
  return {
    id: entry.id,
    entryId: entry.id,
    ...outcomeLineOf({ entry, model }),
    at,
    agentIds: [entry.agent.id],
  };
};

const dayKeyOf = ({ at }: AtParams): string => new Date(at).toDateString();

type RunRowParams = {
  readonly entry: TimelineRunEntry;
  readonly slice: ReadonlyArray<TimelineAgentEntry> | null;
  readonly steps: ReadonlyArray<TimelineAgentEntry>;
  readonly context: Context;
};

const runRowOf = ({ entry, slice, steps, context }: RunRowParams): DoneRowModel | null => {
  const { model } = context;
  const shown = slice ?? steps;
  const at = newestOf({
    values: shown.map((step) => agentAtOf({ agent: step.agent, fallback: step.at }) ?? undefined),
  });
  if (at === null) {
    return null;
  }
  return {
    id: slice === null ? entry.id : `${entry.id}:${dayKeyOf({ at })}`,
    entryId: entry.id,
    ...outcomeLineOf({ entry, model, slice }),
    at,
    agentIds: shown.map((step) => step.agent.id),
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
    agentIds: [],
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
            kind: 'auto',
            leadAgentId: null,
            at: new Date(child.finishedAt).toISOString(),
            agentIds: [],
          },
        ];
      });
    });

export const doneRowsOf = ({ model }: Params): ReadonlyArray<DoneDay> => {
  const batchByEventId = historyBatchByEventIdOf({ events: model.events });
  const context: Context = {
    model,
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
