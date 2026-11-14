import type { WorkspaceId } from '@goodboy/types';
import type { StartWorkSeed, WorkFilter, WorkState } from './state';

type LoadWorkLeadsParams = {
  readonly workspaceId: WorkspaceId;
  readonly filter: WorkFilter;
};

type OpenWorkStartParams = {
  readonly seed: StartWorkSeed;
};

export type WorkSlice = WorkState & {
  loadWorkLeads(params: LoadWorkLeadsParams): Promise<void>;
  openWorkStart(params: OpenWorkStartParams): void;
  closeWorkStart(): void;
};
