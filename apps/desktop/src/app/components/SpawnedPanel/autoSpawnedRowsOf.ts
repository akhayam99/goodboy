import type { Agent } from '@goodboy/types';
import type { RailRow } from '../../../features/auto/chat/railRowsOf';
import { railRowCardOf } from '../../../features/auto/chat/railRowCardOf';
import type { SpawnedRow, SpawnedRowModelSource } from './spawnedRow';

type Params = {
  readonly rows: ReadonlyArray<RailRow>;
  readonly baseLevel: number;
  readonly agents?: ReadonlyArray<Agent>;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

type SourceParams = {
  readonly row: RailRow;
  readonly agents: ReadonlyArray<Agent>;
};

const modelSourceOf = ({ row, agents }: SourceParams): SpawnedRowModelSource | null => {
  const agent = agents.find((candidate) => candidate.id === row.agentId);
  if (agent === undefined) {
    return null;
  }
  return { agent, routing: { provider: row.provider, model: row.model, effort: row.effort } };
};

export const autoSpawnedRowsOf = ({
  rows,
  baseLevel,
  agents = NO_AGENTS,
}: Params): ReadonlyArray<SpawnedRow> =>
  rows.map((row, index): SpawnedRow => ({
    id: row.id,
    agentId: row.agentId,
    level: baseLevel + row.depth,
    hasChildren: (rows[index + 1]?.depth ?? row.depth) > row.depth,
    title: row.label,
    card: railRowCardOf({ row }),
    role: row.role,
    node: row.node,
    word: row.word,
    isLive: row.isLive,
    model: modelSourceOf({ row, agents }),
  }));
