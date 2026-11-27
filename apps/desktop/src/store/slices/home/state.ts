import type { WorkspaceId } from '@goodboy/types';

export type HomeState = {
  readonly openHomeWorkspaceId: WorkspaceId | null;
};

export const homeInitialState: HomeState = {
  openHomeWorkspaceId: null,
};
