import type { RailRow } from '../../../features/auto/chat/railRowsOf';
import { routingLabelModel } from '../../../shared/components/RoutingLabel/routingLabelModel';
import type { SpawnedRow } from './spawnedRow';

type Params = {
  readonly rows: ReadonlyArray<RailRow>;
  readonly baseLevel: number;
};

type DetailParams = {
  readonly row: RailRow;
};

const detailOf = ({ row }: DetailParams): string | null => {
  const route = routingLabelModel({
    provider: row.provider,
    model: row.model,
    effort: row.effort,
    planned: null,
    isEffortObserved: false,
  }).tooltip;
  const parts = [...(row.task === null ? [] : [row.task]), ...(route === '' ? [] : [route])];
  return parts.length === 0 ? null : parts.join(' · ');
};

export const autoSpawnedRowsOf = ({ rows, baseLevel }: Params): ReadonlyArray<SpawnedRow> => {
  const hasChildren = rows.some((row) => row.kind === 'child');
  return rows.map((row): SpawnedRow => ({
    id: row.id,
    agentId: row.agentId,
    level: row.kind === 'child' ? baseLevel + 1 : baseLevel,
    hasChildren: row.kind === 'root' && hasChildren,
    title: row.label,
    detail: detailOf({ row }),
    role: row.role,
    node: row.node,
    word: row.word,
    isLive: row.isLive,
  }));
};
