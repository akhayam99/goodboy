import type { ProjectId } from '@goodboy/types';

export const SAVED_PROJECT_MODELS_PREFIX = 'legacy.projectModels.';

type KeyParams = {
  readonly projectId: ProjectId;
};

type ProjectParams = {
  readonly key: string;
};

export const savedProjectModelsKey = ({ projectId }: KeyParams): string =>
  `${SAVED_PROJECT_MODELS_PREFIX}${projectId}`;

export const projectIdOfSavedKey = ({ key }: ProjectParams): string | null =>
  key.startsWith(SAVED_PROJECT_MODELS_PREFIX) && key.length > SAVED_PROJECT_MODELS_PREFIX.length
    ? key.slice(SAVED_PROJECT_MODELS_PREFIX.length)
    : null;
