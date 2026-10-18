import type { Agent } from '@goodboy/types';
import type { SendTurnInput } from './types';

export const AUTO_CONFINED_ROLE = 'auto';

export const READ_ONLY_ANSWER_ROLE = 'scout';

export type ConfinedRoleOfParams = Readonly<{
  input: Pick<SendTurnInput, 'confinedRole'>;
  agent: Pick<Agent, 'kind'> | null;
}>;

export const confinedRoleOf = ({ input, agent }: ConfinedRoleOfParams): string | undefined => {
  if (input.confinedRole !== undefined) {
    return input.confinedRole;
  }
  return agent?.kind === AUTO_CONFINED_ROLE ? AUTO_CONFINED_ROLE : undefined;
};
