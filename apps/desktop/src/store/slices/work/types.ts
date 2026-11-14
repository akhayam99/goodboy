import type { WorkspaceId } from '@goodboy/types';
import type { WorkFilter, WorkState } from './state';

type LoadWorkLeadsParams = {
  readonly workspaceId: WorkspaceId;
  readonly filter: WorkFilter;
};

export type WorkSlice = WorkState & {
  loadWorkLeads(params: LoadWorkLeadsParams): Promise<void>;
};
