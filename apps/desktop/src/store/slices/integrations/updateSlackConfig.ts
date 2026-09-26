import { upsertIntegrationBinding } from '@goodboy/db';
import type { IsoDateTime, SlackIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly config: SlackIntegrationConfig;
};

export const updateSlackConfig = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, config }: Params): Promise<void> => {
    const binding = get()
      .workspaceIntegrations[workspaceId]?.filter((entry) => entry.provider === 'slack')
      .at(0);
    if (binding === undefined) {
      return;
    }
    const updated = {
      ...binding,
      config,
      updatedAt: new Date().toISOString() as IsoDateTime,
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
  };
};
