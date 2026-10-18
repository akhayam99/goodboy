import { parseAutoDelegationRole } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';
import { AGENT_KIND_META, kindForRole, type AgentKind } from '../session/agent-kind';

type Params = {
  readonly delegations: ReadonlyArray<
    Pick<AutoDelegation, 'childAgentId' | 'role' | 'createdAt' | 'isAdopted'>
  >;
};

type Child = Readonly<{
  childAgentId: AgentId;
  noun: string;
  createdAt: number;
}>;

type NounParams = {
  readonly role: string;
};

const nounOf = ({ role }: NounParams): string => {
  const parsed = parseAutoDelegationRole({ role });
  const kind: AgentKind = parsed === null ? 'generic' : kindForRole({ role: parsed });
  return AGENT_KIND_META[kind].noun;
};

export const autoChildLabelsOf = ({ delegations }: Params): ReadonlyMap<AgentId, string> => {
  const firstByChild = new Map<AgentId, Child>();
  for (const delegation of delegations) {
    if (delegation.isAdopted) {
      continue;
    }
    const known = firstByChild.get(delegation.childAgentId);
    if (known !== undefined && known.createdAt <= delegation.createdAt) {
      continue;
    }
    firstByChild.set(delegation.childAgentId, {
      childAgentId: delegation.childAgentId,
      noun: nounOf({ role: delegation.role }),
      createdAt: delegation.createdAt,
    });
  }
  const children = [...firstByChild.values()].sort(
    (a, b) => a.createdAt - b.createdAt || a.childAgentId.localeCompare(b.childAgentId),
  );
  const countByNoun = new Map<string, number>();
  for (const child of children) {
    countByNoun.set(child.noun, (countByNoun.get(child.noun) ?? 0) + 1);
  }
  const seenByNoun = new Map<string, number>();
  const labels = new Map<AgentId, string>();
  for (const child of children) {
    const ordinal = (seenByNoun.get(child.noun) ?? 0) + 1;
    seenByNoun.set(child.noun, ordinal);
    const isAlone = (countByNoun.get(child.noun) ?? 0) < 2;
    labels.set(child.childAgentId, isAlone ? child.noun : `${child.noun} ${ordinal}`);
  }
  for (const delegation of delegations) {
    if (delegation.isAdopted && !labels.has(delegation.childAgentId)) {
      labels.set(delegation.childAgentId, nounOf({ role: delegation.role }));
    }
  }
  return labels;
};
