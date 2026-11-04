import type { LiveGroupModel } from './liveGroupsOf';
import { LIVE_TONE } from './liveTone';

type Params = {
  readonly group: LiveGroupModel;
  readonly word: string;
};

export const liveOwnStateOf = ({ group, word }: Params): boolean =>
  group.state === 'working' && word === LIVE_TONE.state.working.word;
