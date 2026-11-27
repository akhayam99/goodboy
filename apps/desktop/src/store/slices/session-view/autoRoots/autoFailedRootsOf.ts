import type { Agent, Session } from '@goodboy/types';
import { autoTreeStatesOf } from './autoTreeStatesOf';
import { isFailureSettled } from '../../../../features/auto/isFailureSettled';
import type { AutoWaitState } from './autoWaitRootsOf';

type Params = {
  readonly state: AutoWaitState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly settledAt?: number | null;
};

export const autoFailedRootsOf = ({
  state,
  session,
  agents,
  settledAt = null,
}: Params): ReadonlyArray<Agent> =>
  autoTreeStatesOf({ state, session, agents })
    .filter((entry) => entry.state === 'failed' && !isFailureSettled({ at: entry.at, settledAt }))
    .map((entry) => entry.root);
