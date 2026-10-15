import { parseAutoDelegationRole } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import { AGENT_KIND_META, kindForRole } from '../session/agent-kind';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

export const openRoleNouns = ({ delegations }: Params): ReadonlyArray<string> => {
  const nouns: string[] = [];
  for (const delegation of delegations) {
    const role = parseAutoDelegationRole({ role: delegation.role });
    if (delegation.state === 'settled' || role === null) {
      continue;
    }
    const noun = AGENT_KIND_META[kindForRole({ role })].noun;
    if (!nouns.includes(noun)) {
      nouns.push(noun);
    }
  }
  return nouns;
};
