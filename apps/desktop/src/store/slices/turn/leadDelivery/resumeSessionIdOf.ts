import type { Agent, ProviderId } from '@goodboy/types';
import type { SendTurnInput } from '../types';

type Params = Readonly<{
  origin: SendTurnInput['origin'];
  agent: Agent | null;
  provider: ProviderId;
}>;

export const resumeSessionIdOf = ({ origin, agent, provider }: Params): string | undefined =>
  origin !== 'mount-continuation' && agent?.providerSessionProviderId === provider
    ? agent.providerSessionId
    : undefined;
