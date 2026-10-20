import type { RailRow } from '../../../features/auto/chat/railRowsOf';
import { railRowCardOf } from '../../../features/auto/chat/railRowCardOf';
import type { SpawnedRow } from './spawnedRow';

type Params = {
  readonly rows: ReadonlyArray<RailRow>;
  readonly baseLevel: number;
};

export const autoSpawnedRowsOf = ({ rows, baseLevel }: Params): ReadonlyArray<SpawnedRow> =>
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
  }));
