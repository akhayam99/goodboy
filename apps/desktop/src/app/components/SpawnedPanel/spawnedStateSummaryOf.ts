import type { SpawnedStateGroup } from './spawnedStateGroupsOf';

type Params = {
  readonly groups: ReadonlyArray<SpawnedStateGroup>;
};

export const spawnedStateSummaryOf = ({ groups }: Params): string =>
  groups.map((group) => `${group.rows.length} ${group.label.toLowerCase()}`).join(', ');
