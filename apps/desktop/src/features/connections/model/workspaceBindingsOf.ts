import type { IntegrationBinding } from '@goodboy/types';

type Params = {
  readonly integrations: ReadonlyArray<IntegrationBinding>;
};

export const workspaceBindingsOf = ({ integrations }: Params): ReadonlyArray<IntegrationBinding> =>
  integrations.filter((binding) => binding.projectId === null);
