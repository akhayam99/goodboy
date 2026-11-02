import type { LiveGroupModel } from './liveGroupsOf';
import { liveSectionIdOf } from './liveSectionIdOf';

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

export const waitingGroupsOf = ({ groups }: Params): ReadonlyArray<LiveGroupModel> =>
  groups
    .filter((group) => liveSectionIdOf({ group }) === 'needs-you')
    .sort((first, second) => first.startedAt - second.startedAt);
