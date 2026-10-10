import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { SavedProjectModelsState } from './state';

export type { SetFn, GetFn } from '../../slice-types';

type ApplySavedProjectModelsParams = {
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId;
};

type DiscardSavedProjectModelsParams = {
  readonly projectId: ProjectId;
};

export type SavedProjectModelsSlice = SavedProjectModelsState & {
  loadSavedProjectModels(): Promise<void>;
  applySavedProjectModels(params: ApplySavedProjectModelsParams): Promise<void>;
  discardSavedProjectModels(params: DiscardSavedProjectModelsParams): Promise<void>;
};
