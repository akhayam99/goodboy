import type { WorkspaceId } from '@goodboy/types';
import type { WorkspaceValueKey } from '@goodboy/db';

export type SettingsState = {
  readonly settings: Readonly<Record<string, string>>;
  readonly workspaceValues: Readonly<
    Record<WorkspaceId, Readonly<Partial<Record<WorkspaceValueKey, string>>>>
  >;
};

export const settingsInitialState: SettingsState = {
  settings: {},
  workspaceValues: {},
};
