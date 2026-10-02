import type { BootstrapPhase, ProjectId } from '@goodboy/types';
import type { NewProject } from './createNewProject';
import type { BootstrapState } from './state';

export type CreateNewProjectParams = {
  readonly parentPath: string;
  readonly name: string;
};

export type SetBootstrapPhaseParams = {
  readonly projectId: ProjectId;
  readonly patch: Partial<Omit<BootstrapPhase, 'updatedAt'>>;
};

export type BootstrapSlice = BootstrapState & {
  hydrateBootstrapPhases(): Promise<void>;
  setBootstrapPhase(params: SetBootstrapPhaseParams): Promise<BootstrapPhase>;
  createNewProject(params: CreateNewProjectParams): Promise<NewProject>;
};
