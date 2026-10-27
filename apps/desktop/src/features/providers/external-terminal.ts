import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';

type Params = {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
};

export const openCommandInExternalTerminal = async ({
  providerId,
  action,
}: Params): Promise<void> => {
  await invokeCommand('open_command_in_external_terminal', { providerId, action });
};
