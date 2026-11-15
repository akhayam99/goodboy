import { isApiProvider } from '@goodboy/core/providers';
import type { ProviderDisplayInfo } from '../../providers/providers';

type Params = {
  readonly provider: Pick<ProviderDisplayInfo, 'id' | 'connection' | 'standing'>;
};

export const providerSetupVerb = ({ provider }: Params): string | null => {
  const isKeyed = isApiProvider({ id: provider.id });
  if (provider.connection === 'missing') {
    return isKeyed ? 'Add a key' : 'Install CLI';
  }
  if (provider.connection !== 'installed_disconnected') {
    return null;
  }
  if (isKeyed) {
    return 'Add a key';
  }
  return provider.standing === 'signed_out' ? null : 'Sign in';
};
