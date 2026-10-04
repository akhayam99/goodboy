import type { Agent, AgentId, MeasuredTurnSpan } from '@goodboy/types';
import type { WorkTimeSource } from '../../workTreeModel/workTimeSource';
import type { TimelineRowItem, TimelineStreamItem } from './buildTimelineStream';
import { groupTotals, rootsCost, settledTimeSource, type GroupTotals } from './groupTotals';

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly agents: ReadonlyArray<Agent>;
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly spendByAgentId: ReadonlyMap<string, number>;
  readonly spendByRunId: ReadonlyMap<string, number>;
  readonly previous: ReadonlyMap<string, GroupTotals>;
};

type Context = Omit<Params, 'items' | 'agents' | 'spans' | 'previous'> & {
  readonly source: WorkTimeSource;
};

const isSameTotals = ({
  left,
  right,
}: {
  readonly left: GroupTotals;
  readonly right: GroupTotals;
}): boolean =>
  left.costUsd === right.costUsd &&
  left.time?.label === right.time?.label &&
  left.time?.detail === right.time?.detail;

const totalsOf = ({
  item,
  context,
}: {
  readonly item: TimelineRowItem;
  readonly context: Context;
}): GroupTotals | null => {
  const { entry } = item;
  const { source, spendByAgentId, spendByRunId } = context;
  if (entry.kind === 'run' && item.fold !== undefined) {
    return groupTotals({
      roots: entry.children.flatMap((child) => (child.kind === 'agent' ? [child.agent.id] : [])),
      costUsd: spendByRunId.get(entry.run.id) ?? 0,
      isSettled: true,
      source,
    });
  }
  if (entry.kind === 'agent' && item.fold !== undefined) {
    return groupTotals({
      roots: [entry.agent.id],
      costUsd: spendByAgentId.get(entry.agent.id) ?? 0,
      isSettled: true,
      source,
    });
  }
  if (entry.kind !== 'resolveBatch') {
    return null;
  }
  const roots: ReadonlyArray<AgentId> = entry.children.map((child) => child.agent.id);
  return groupTotals({
    roots,
    costUsd: rootsCost({ roots, spendByAgentId }),
    isSettled: item.rowState.phase === 'done',
    source,
  });
};

export const groupTotalsById = ({
  items,
  agents,
  spans,
  spendByAgentId,
  spendByRunId,
  previous,
}: Params): ReadonlyMap<string, GroupTotals> => {
  const context: Context = {
    spendByAgentId,
    spendByRunId,
    source: settledTimeSource({ spans, agents }),
  };
  const totals = new Map<string, GroupTotals>();
  for (const item of items) {
    if (item.kind !== 'row') {
      continue;
    }
    const next = totalsOf({ item, context });
    if (next === null) {
      continue;
    }
    const kept = previous.get(item.id);
    totals.set(
      item.id,
      kept !== undefined && isSameTotals({ left: kept, right: next }) ? kept : next,
    );
  }
  return totals;
};
