import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { Agent } from '@goodboy/types';
import { autoTreeOfAgent } from '../../../features/auto/autoTreeOfAgent';
import type { AutoTreeView } from '../auto-view/state';
import type { SendTurnInput } from './types';

export const AUTO_CONFINED_ROLE = 'auto';

export const READ_ONLY_ANSWER_ROLE = 'scout';

export type ConfinedRoleOfParams = Readonly<{
  input: Pick<SendTurnInput, 'confinedRole'>;
  agent: Pick<Agent, 'id' | 'kind'> | null;
  views: ReadonlyArray<AutoTreeView>;
}>;

export const confinedRoleOf = ({
  input,
  agent,
  views,
}: ConfinedRoleOfParams): string | undefined => {
  if (input.confinedRole !== undefined) {
    return input.confinedRole;
  }
  if (agent === null) {
    return undefined;
  }
  if (agent.kind === AUTO_CONFINED_ROLE) {
    return AUTO_CONFINED_ROLE;
  }
  const found = autoTreeOfAgent({ views, agentId: agent.id });
  if (found?.kind !== 'child') {
    return undefined;
  }
  return parseAutoDelegationRole({ role: found.delegation.role }) ?? undefined;
};
