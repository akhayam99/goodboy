import type { WorkspaceId } from '@goodboy/types';
import type { WorkState } from './state';

type LoadWorkLeadsParams = {
  readonly workspaceId: WorkspaceId;
};

export type WorkSlice = WorkState & {
  loadWorkLeads(params: LoadWorkLeadsParams): Promise<void>;
};
