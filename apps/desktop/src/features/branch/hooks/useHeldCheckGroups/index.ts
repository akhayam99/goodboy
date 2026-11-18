import { useState } from 'react';
import type { PrCheckRun } from '@goodboy/types';
import type { HeldCheckGroups } from '../../../integrations/github/checksRollup';
import { heldCheckGroupsOf } from '../../checks/heldCheckGroupsOf';

type Params = {
  readonly scope: string;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

type Held = {
  readonly scope: string;
  readonly groups: HeldCheckGroups;
};

const NONE: HeldCheckGroups = new Map();

export const useHeldCheckGroups = ({ scope, checks }: Params): HeldCheckGroups => {
  const [held, setHeld] = useState<Held>(() => ({
    scope,
    groups: heldCheckGroupsOf({ held: NONE, checks }),
  }));
  const isSameScope = held.scope === scope;
  const groups = heldCheckGroupsOf({ held: isSameScope ? held.groups : NONE, checks });
  if (!isSameScope || groups !== held.groups) {
    setHeld({ scope, groups });
  }
  return groups;
};
