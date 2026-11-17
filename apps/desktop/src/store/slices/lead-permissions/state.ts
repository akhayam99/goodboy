import type { WorkspaceId } from '@goodboy/types';

export type LeadPermissionsState = {
  readonly leadPermissionsRevisionByWorkspace: Readonly<Record<WorkspaceId, number>>;
};

export const leadPermissionsInitialState: LeadPermissionsState = {
  leadPermissionsRevisionByWorkspace: {},
};
