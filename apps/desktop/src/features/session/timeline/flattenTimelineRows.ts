import type {
  TimelineAgentEntry,
  TimelineAnswerEntry,
  TimelineBranchEntry,
  TimelineIssueEntry,
  TimelinePlanEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from './buildTimelineGroups';
import type { RunIdentity } from './runIdentity';

export type TimelineDepth = 0 | 1 | 2;

export type TimelineRowEntry =
  | TimelineRunEntry
  | TimelineAgentEntry
  | TimelinePlanEntry
  | TimelineIssueEntry
  | TimelineBranchEntry
  | TimelineAnswerEntry;

export type TimelineFlatRow = {
  readonly kind: 'row';
  readonly id: string;
  readonly at: string | null;
  readonly depth: TimelineDepth;
  readonly identity: RunIdentity | null;
  readonly runId: string | null;
  readonly entry: TimelineRowEntry;
};

export type TimelineDayBreak = {
  readonly kind: 'day';
  readonly id: string;
  readonly at: string;
  readonly identity: RunIdentity | null;
};

export type TimelineItem = TimelineFlatRow | TimelineDayBreak;

type FlattenParams = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly expandedIds: ReadonlySet<string>;
};

type AgentParams = {
  readonly entry: TimelineAgentEntry;
  readonly depth: TimelineDepth;
  readonly identity: RunIdentity | null;
  readonly runId: string | null;
  readonly expandedIds: ReadonlySet<string>;
};

const deeper = (depth: TimelineDepth): TimelineDepth => (depth === 0 ? 1 : 2);

const agentRows = ({
  entry,
  depth,
  identity,
  runId,
  expandedIds,
}: AgentParams): TimelineFlatRow[] => {
  const rows: TimelineFlatRow[] = [
    { kind: 'row', id: entry.id, at: entry.at, depth, identity, runId, entry },
  ];
  const childDepth = deeper(depth);
  for (const answer of entry.answers) {
    rows.push({
      kind: 'row',
      id: answer.id,
      at: answer.at,
      depth: childDepth,
      identity,
      runId,
      entry: answer,
    });
  }
  if (!expandedIds.has(entry.id)) {
    return rows;
  }
  for (const child of entry.children) {
    rows.push(...agentRows({ entry: child, depth: childDepth, identity, runId, expandedIds }));
  }
  return rows;
};

export const flattenTimelineRows = ({
  entries,
  expandedIds,
}: FlattenParams): ReadonlyArray<TimelineFlatRow> => {
  const rows: TimelineFlatRow[] = [];
  for (const entry of entries) {
    if (entry.kind === 'run') {
      rows.push({
        kind: 'row',
        id: entry.id,
        at: entry.at,
        depth: 0,
        identity: entry.identity,
        runId: entry.run.id,
        entry,
      });
      if (!expandedIds.has(entry.id)) {
        continue;
      }
      for (const child of entry.children) {
        if (child.kind === 'agent') {
          rows.push(
            ...agentRows({
              entry: child,
              depth: 1,
              identity: entry.identity,
              runId: entry.run.id,
              expandedIds,
            }),
          );
          continue;
        }
        rows.push({
          kind: 'row',
          id: child.id,
          at: child.at,
          depth: 1,
          identity: entry.identity,
          runId: entry.run.id,
          entry: child,
        });
      }
      continue;
    }
    if (entry.kind === 'agent') {
      rows.push(...agentRows({ entry, depth: 0, identity: null, runId: null, expandedIds }));
      continue;
    }
    rows.push({
      kind: 'row',
      id: entry.id,
      at: entry.at,
      depth: 0,
      identity: null,
      runId: null,
      entry,
    });
  }
  return rows;
};

type DayParams = {
  readonly rows: ReadonlyArray<TimelineFlatRow>;
  readonly labelFor: (params: { readonly at: string }) => string | null;
};

const localDayKey = ({ at }: { readonly at: string }): string => new Date(at).toDateString();

export const withDayBreaks = ({ rows, labelFor }: DayParams): ReadonlyArray<TimelineItem> => {
  const items: TimelineItem[] = [];
  let previousDay: string | null = null;
  let previousRunId: string | null = null;

  for (const row of rows) {
    if (row.at == null) {
      items.push(row);
      continue;
    }
    const day = localDayKey({ at: row.at });
    if (day !== previousDay && labelFor({ at: row.at }) !== null) {
      const isSameRun = previousRunId !== null && previousRunId === row.runId;
      items.push({
        kind: 'day',
        id: `day:${day}:${row.id}`,
        at: row.at,
        identity: isSameRun ? row.identity : null,
      });
    }
    previousDay = day;
    previousRunId = row.runId;
    items.push(row);
  }

  return items;
};
