import type { Agent, Session } from '@goodboy/types';
import type { AppState } from '../../../types';
import type { AutoViewState } from '../../auto-view/state';
import { autoTreeStatesOf } from './autoTreeStatesOf';

export type AutoWaitState = Pick<AppState, 'agentTurnState'> &
  Partial<Pick<AppState, 'agentKindOverride'> & AutoViewState>;

type Params = {
  readonly state: AutoWaitState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
};

export const autoWaitRootsOf = ({ state, session, agents }: Params): ReadonlyArray<Agent> =>
  autoTreeStatesOf({ state, session, agents })
    .filter((entry) => entry.state === 'asking' || entry.isStuck)
    .map((entry) => entry.root);
