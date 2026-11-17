import { useState } from 'react';
import type { PrCheckRun } from '@goodboy/types';
import type { HeldCheckGroups } from '../../../integrations/github/checksRollup';
import { heldCheckGroupsOf } from '../../checks/heldCheckGroupsOf';

type Params = {
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const NONE: HeldCheckGroups = new Map();

export const useHeldCheckGroups = ({ checks }: Params): HeldCheckGroups => {
  const [held, setHeld] = useState<HeldCheckGroups>(() =>
    heldCheckGroupsOf({ held: NONE, checks }),
  );
  const next = heldCheckGroupsOf({ held, checks });
  if (next !== held) {
    setHeld(next);
  }
  return next;
};
