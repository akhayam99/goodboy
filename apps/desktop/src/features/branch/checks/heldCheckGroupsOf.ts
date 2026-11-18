import type { PrCheckRun } from '@goodboy/types';
import {
  checkGroupOf,
  type ChecksGroup,
  type HeldCheckGroups,
} from '../../integrations/github/checksRollup';

type Params = {
  readonly held: HeldCheckGroups;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

export const heldCheckGroupsOf = ({ held, checks }: Params): HeldCheckGroups => {
  const fresh = checks.filter((check) => !held.has(check.name));
  if (fresh.length === 0) {
    return held;
  }
  const next = new Map<string, ChecksGroup>(held);
  for (const check of fresh) {
    if (!next.has(check.name)) {
      next.set(check.name, checkGroupOf({ conclusion: check.conclusion }));
    }
  }
  return next;
};
