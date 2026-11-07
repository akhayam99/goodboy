import type { Agent } from '@goodboy/types';
import { formatErrorForHumans } from './formatErrorForHumans';

type Params = {
  readonly message: string;
  readonly agent?: Pick<Agent, 'providerOverride' | 'providerSessionProviderId'>;
};

export const humanTurnErrorOf = ({ message, agent }: Params): string => {
  const providerId = agent?.providerSessionProviderId ?? agent?.providerOverride ?? null;
  const human = formatErrorForHumans({ message, providerId });
  return human.body === null || human.body === '' ? 'The reply failed.' : human.body;
};
