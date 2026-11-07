import type { Agent } from '@goodboy/types';
import { formatErrorForHumans } from './formatErrorForHumans';

type Params = {
  readonly message: string;
  readonly agent?: Pick<Agent, 'providerOverride' | 'providerSessionProviderId'>;
};

export const humanTurnErrorOf = ({ message, agent }: Params): string => {
  const providerId = agent?.providerOverride ?? agent?.providerSessionProviderId ?? null;
  const human = formatErrorForHumans({ message, providerId });
  return human.body === null || human.body === '' ? message : human.body;
};
