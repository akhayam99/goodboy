import { upsertIntegrationBinding } from '@goodboy/db';
import type { SlackIntegrationBinding, SlackIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { tauriDatabase } from '../../../shared/lib/db';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';
import type { SliceDeps } from '../../slice-types';

type ConfigParams = {
  readonly config: SlackIntegrationConfig;
};

export type SlackConfigUpdate = (params: ConfigParams) => SlackIntegrationConfig;

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly update: SlackConfigUpdate;
};

const SLACK_CONFIG_WRITES = createSerialQueue();

export const updateSlackConfig = ({ set, get }: SliceDeps) => {
  return ({ workspaceId, update }: Params): Promise<void> =>
    SLACK_CONFIG_WRITES.run({
      key: workspaceId,
      task: async () => {
        const binding = (get().workspaceIntegrations[workspaceId] ?? []).find(
          (entry): entry is SlackIntegrationBinding => entry.provider === 'slack',
        );
        if (binding === undefined) {
          return;
        }
        const updated = {
          ...binding,
          config: update({ config: binding.config }),
          updatedAt: isoNow(),
        };
        await upsertIntegrationBinding({ db: tauriDatabase, binding: updated });
        set((state) => ({
          workspaceIntegrations: {
            ...state.workspaceIntegrations,
            [workspaceId]: (state.workspaceIntegrations[workspaceId] ?? []).map((entry) =>
              entry.id === binding.id ? updated : entry,
            ),
          },
        }));
      },
    });
};
