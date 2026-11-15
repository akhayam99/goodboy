import { isApiProvider } from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';
import { CLI_LABEL } from '../../providers/cliLabel';
import type { ProviderDisplayInfo } from '../../providers/providers';

type Params = {
  readonly providerId: ProviderId;
  readonly connection: ProviderDisplayInfo['connection'];
};

export const providerSetupLine = ({ providerId, connection }: Params): string => {
  if (isApiProvider({ id: providerId })) {
    return 'Runs with your API key';
  }
  if (connection === 'missing') {
    return `${CLI_LABEL[providerId]} isn't on this Mac`;
  }
  return `${CLI_LABEL[providerId]} found, not signed in`;
};
