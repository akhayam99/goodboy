import type { RoleModelPreferences, TaskModelPreferences } from '@goodboy/types';

export type SavedProjectModels = Readonly<{
  taskModels: TaskModelPreferences | null;
  roleModels: RoleModelPreferences | null;
}>;

export type SavedProjectModelsState = {
  readonly savedProjectModels: Readonly<Record<string, SavedProjectModels>>;
};

export const savedProjectModelsInitialState: SavedProjectModelsState = {
  savedProjectModels: {},
};
