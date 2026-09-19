import type { RoleModelPreferences } from '@goodboy/types';

type Params = {
  readonly workspace: RoleModelPreferences | null | undefined;
  readonly run: RoleModelPreferences | null | undefined;
};

export const mergeRoleModels = ({ workspace, run }: Params): RoleModelPreferences | null => {
  if (workspace == null && run == null) {
    return null;
  }
  return { ...(workspace ?? {}), ...(run ?? {}) };
};
