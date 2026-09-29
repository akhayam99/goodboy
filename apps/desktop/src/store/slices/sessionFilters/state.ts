import type { WorkspaceId } from '@goodboy/types';

export type SessionFiltersState = {
  readonly selectedProjectIds: Readonly<Record<WorkspaceId, ReadonlyArray<string>>>;
};

export const sessionFiltersInitialState: SessionFiltersState = {
  selectedProjectIds: {},
};
