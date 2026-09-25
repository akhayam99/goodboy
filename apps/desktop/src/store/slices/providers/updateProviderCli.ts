import { cleanCliVersion } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { CLI_LABEL } from '../../../features/providers/cliLabel';
import { runLifecycle } from './runLifecycle';
import type { GetFn, SetFn } from './types';

export const updateProviderCli = (set: SetFn, get: GetFn) => {
  return async (providerId: ProviderId): Promise<void> => {
    const before = cleanCliVersion({
      raw: get().providers.find((provider) => provider.id === providerId)?.version ?? null,
    });
    await runLifecycle(set, get, {
      providerId,
      action: 'update',
      onExit: (payload) => {
        if (payload.exitCode !== 0 || !payload.status.available) {
          return;
        }
        const after = cleanCliVersion({ raw: payload.status.version });
        const cli = CLI_LABEL[providerId];
        void get()
          .emitNotification({
            kind: 'provider-cli-updated',
            severity: 'success',
            title: after === null ? `${cli} updated` : `${cli} updated to ${after}`,
            body: before !== null && before !== after ? `It was ${before}.` : null,
            coalesceKey: `provider-cli-updated:${providerId}`,
          })
          .catch(() => undefined);
      },
    });
  };
};
