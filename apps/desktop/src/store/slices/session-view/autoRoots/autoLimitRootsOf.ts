import type { Agent, Session } from '@goodboy/types';
import { autoTreeStatesOf } from './autoTreeStatesOf';
import type { AutoWaitState } from './autoWaitRootsOf';

type Params = {
  readonly state: AutoWaitState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
};

export const autoLimitRootsOf = ({ state, session, agents }: Params): ReadonlyArray<Agent> =>
  autoTreeStatesOf({ state, session, agents })
    .filter((entry) => entry.state === 'paused')
    .map((entry) => entry.root);
