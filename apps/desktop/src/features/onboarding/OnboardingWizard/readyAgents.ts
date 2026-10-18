import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../providers/providers';
import { AGENT_ROW_IDS } from './agentRowIds';

type Params = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
};

const ORDER: ReadonlyArray<ProviderId> = [...AGENT_ROW_IDS, 'opencode', 'openrouter', 'moonshot'];

export const readyAgents = ({ providers }: Params): ReadonlyArray<ProviderId> =>
  ORDER.filter((id) =>
    providers.some((provider) => provider.id === id && provider.connection === 'connected'),
  );
