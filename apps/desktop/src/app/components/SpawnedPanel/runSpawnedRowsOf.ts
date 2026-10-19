import type { TimelineStreamItem } from '../../../features/session/timeline/buildTimelineStream';
import { groupSummaryText } from '../../../features/session/timeline/groupSummary';
import { rowStateNode } from '../../../features/workTreeModel/rowStateCopy';
import type { SpawnedRow } from './spawnedRow';

export type SpawnedFold = Readonly<{
  id: string;
  expandId: string;
  level: number;
  isExpanded: boolean;
  label: string;
}>;

export type SpawnedRunEntry =
  Readonly<{ kind: 'agent'; row: SpawnedRow }> | Readonly<{ kind: 'fold'; fold: SpawnedFold }>;

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly baseLevel: number;
};

type DepthParams = {
  readonly agentId: string;
  readonly parentOf: ReadonlyMap<string, string | null>;
};

const depthOf = ({ agentId, parentOf }: DepthParams): number => {
  let depth = 0;
  let parent = parentOf.get(agentId) ?? null;
  const seen = new Set<string>([agentId]);
  while (parent !== null && parentOf.has(parent) && !seen.has(parent)) {
    seen.add(parent);
    depth += 1;
    parent = parentOf.get(parent) ?? null;
  }
  return depth;
};

export const runSpawnedRowsOf = ({ items, baseLevel }: Params): ReadonlyArray<SpawnedRunEntry> => {
  const agents = items.flatMap((item) =>
    item.kind === 'row' && item.entry.kind === 'agent' ? [item.entry.agent] : [],
  );
  const parentOf = new Map<string, string | null>(
    agents.map((agent) => [agent.id, agent.parentAgentId ?? null]),
  );
  const parents = new Set(
    agents.flatMap((agent) => (agent.parentAgentId == null ? [] : [agent.parentAgentId])),
  );
  const entries: Array<SpawnedRunEntry> = [];
  let lastLevel = baseLevel;
  for (const item of items) {
    if (item.kind === 'count') {
      const previous = entries.at(-1);
      if (previous?.kind === 'agent') {
        entries[entries.length - 1] = {
          kind: 'agent',
          row: { ...previous.row, hasChildren: true },
        };
      }
      entries.push({
        kind: 'fold',
        fold: {
          id: item.id,
          expandId: item.expandId,
          level: lastLevel + 1,
          isExpanded: item.isExpanded,
          label: groupSummaryText({ summary: item.summary }),
        },
      });
      continue;
    }
    if (item.kind !== 'row' || item.entry.kind !== 'agent') {
      continue;
    }
    const { agent } = item.entry;
    const node = rowStateNode({ state: item.rowState });
    const level = baseLevel + depthOf({ agentId: agent.id, parentOf });
    lastLevel = level;
    entries.push({
      kind: 'agent',
      row: {
        id: agent.id,
        agentId: agent.id,
        level,
        hasChildren: parents.has(agent.id),
        title: agent.name,
        detail: null,
        role: item.entry.agentKind,
        node: node.state,
        word: node.label,
        isLive: item.rowState.phase === 'running',
      },
    });
  }
  return entries;
};
