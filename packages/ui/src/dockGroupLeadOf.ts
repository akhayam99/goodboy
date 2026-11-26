import type { DockGroups } from './dockLayoutAfterMove';

type Params = {
  readonly groups: DockGroups;
  readonly key: string;
};

export const dockGroupLeadOf = ({ groups, key }: Params): string | null =>
  Object.keys(groups).find((lead) => groups[lead]?.includes(key) === true) ?? null;
