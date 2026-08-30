import type { WorkspaceId } from '@goodboy/types';

export type { GetFn, SetFn } from '../../slice-types';

export const NO_PROJECT_FILTER_ID = '__goodboy_no_project__';

export type GetSelectedProjectIdsParams = {
  readonly workspaceId: WorkspaceId;
};

export type SetSelectedProjectIdsParams = {
  readonly workspaceId: WorkspaceId;
  readonly selectedProjectIds: ReadonlyArray<string>;
};

export type SessionFiltersSlice = {
  readonly selectedProjectIds: Readonly<Record<WorkspaceId, ReadonlyArray<string>>>;
  getSelectedProjectIds(params: GetSelectedProjectIdsParams): ReadonlyArray<string>;
  setSelectedProjectIds(params: SetSelectedProjectIdsParams): void;
};
