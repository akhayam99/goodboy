import type { LiveGroupModel } from './liveGroupsOf';

type Params = {
  readonly group: Pick<LiveGroupModel, 'state'>;
  readonly isStateWord: boolean;
};

export const liveOwnStateOf = ({ group, isStateWord }: Params): boolean =>
  group.state === 'working' && isStateWord;
