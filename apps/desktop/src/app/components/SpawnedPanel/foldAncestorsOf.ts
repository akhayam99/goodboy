import type { AgentId } from '@goodboy/types';
import { parentIdsOf } from './parentIdsOf';
import type { SpawnedRow } from './spawnedRow';

type Params = {
  readonly rows: ReadonlyArray<SpawnedRow>;
  readonly agentId: AgentId;
};

export const foldAncestorsOf = ({ rows, agentId }: Params): ReadonlyArray<string> | null => {
  const target = rows.find((row) => row.agentId === agentId);
  if (target === undefined) {
    return null;
  }
  const parentById = parentIdsOf({ nodes: rows });
  const ancestors: string[] = [];
  let parentId = parentById.get(target.id) ?? null;
  while (parentId !== null) {
    ancestors.push(parentId);
    parentId = parentById.get(parentId) ?? null;
  }
  return ancestors;
};
