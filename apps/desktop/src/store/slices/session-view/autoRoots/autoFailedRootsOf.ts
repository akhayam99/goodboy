import type { Agent, Session } from '@goodboy/types';
import { autoTreeStatesOf } from './autoTreeStatesOf';
import { isFailureSettled } from '../../../../features/auto/isFailureSettled';
import type { AutoWaitState } from './autoWaitRootsOf';

type Params = {
  readonly state: AutoWaitState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly settledAt?: () => number | null;
};

const NEVER_SETTLED = (): null => null;

export const autoFailedRootsOf = ({
  state,
  session,
  agents,
  settledAt = NEVER_SETTLED,
}: Params): ReadonlyArray<Agent> => {
  const failed = autoTreeStatesOf({ state, session, agents }).filter(
    (entry) => entry.state === 'failed',
  );
  if (failed.length === 0) {
    return [];
  }
  const mergedAt = settledAt();
  return failed
    .filter((entry) => !isFailureSettled({ at: entry.at, settledAt: mergedAt }))
    .map((entry) => entry.root);
};
