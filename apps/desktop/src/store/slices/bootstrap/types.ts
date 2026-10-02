import type { BootstrapPhase, ProjectId, Session } from '@goodboy/types';
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

export type EnsureFirstLapSessionParams = {
  readonly projectId: ProjectId;
};

export type BootstrapSlice = BootstrapState & {
  hydrateBootstrapPhases(): Promise<void>;
  setBootstrapPhase(params: SetBootstrapPhaseParams): Promise<BootstrapPhase>;
  createNewProject(params: CreateNewProjectParams): Promise<NewProject>;
  ensureFirstLapSession(params: EnsureFirstLapSessionParams): Promise<Session>;
};
