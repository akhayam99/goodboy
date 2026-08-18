import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly workspaceId: WorkspaceId;
};

export const declineIntegrationReuse = (set: SetFn) => {
  return ({ provider, workspaceId }: Params): void => {
    set((state) => {
      const current = state.declinedIntegrationReuse[workspaceId] ?? [];
      if (current.includes(provider)) {
        return {};
      }
      return {
        declinedIntegrationReuse: {
          ...state.declinedIntegrationReuse,
          [workspaceId]: [...current, provider],
        },
      };
    });
  };
};
