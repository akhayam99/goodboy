import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly workspaceId: WorkspaceId;
};

export const declineIntegrationReuse = (set: SetFn, get: GetFn) => {
  return ({ provider, workspaceId }: Params): void => {
    const current = get().declinedIntegrationReuse[workspaceId] ?? [];
    if (current.includes(provider)) {
      return;
    }
    set((state) => ({
      declinedIntegrationReuse: {
        ...state.declinedIntegrationReuse,
        [workspaceId]: [...current, provider],
      },
    }));
  };
};
