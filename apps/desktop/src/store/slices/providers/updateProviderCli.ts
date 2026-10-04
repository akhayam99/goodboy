import type { ProviderId } from '@goodboy/types';
import { CLI_LABEL } from '../../../features/providers/cliLabel';
import { runLifecycle } from './runLifecycle';
import type { GetFn, SetFn } from './types';

export const updateProviderCli = (set: SetFn, get: GetFn) => {
  return async (providerId: ProviderId): Promise<void> => {
    await runLifecycle(set, get, {
      providerId,
      action: 'update',
      onExit: () => {
        const result = get().providerLifecycle[providerId].update;
        if (result === null || result.outcome !== 'updated' || result.after === null) {
          return;
        }
        const cli = CLI_LABEL[providerId];
        void get()
          .emitNotification({
            kind: 'provider-cli-updated',
            severity: 'success',
            title: `${cli} updated to ${result.after}`,
            body: result.before === null ? null : `It was ${result.before}.`,
            coalesceKey: `provider-cli-updated:${providerId}`,
          })
          .catch(() => undefined);
      },
    });
  };
};
