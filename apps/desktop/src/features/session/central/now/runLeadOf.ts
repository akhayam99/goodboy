import type { LiveGroupModel } from './liveGroupsOf';

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

export const runLeadOf = ({ groups }: Params): string | null =>
  groups.find(
    (group) => (group.kind === 'run' || group.kind === 'orchestrated') && group.state === 'waiting',
  )?.id ?? null;
