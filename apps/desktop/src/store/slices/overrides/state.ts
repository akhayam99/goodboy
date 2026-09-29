import type { WorkspaceId, OverrideSettings, SessionId } from '@goodboy/types';

export type OverridesState = {
  readonly workspaceOverrides: Readonly<Record<WorkspaceId, OverrideSettings>>;
  readonly sessionOverrides: Readonly<Record<SessionId, OverrideSettings>>;
};

export const overridesInitialState: OverridesState = {
  workspaceOverrides: {},
  sessionOverrides: {},
};
