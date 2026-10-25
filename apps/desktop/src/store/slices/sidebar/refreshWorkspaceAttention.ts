import { invokeWorkspacesAttention } from '../../../features/workflows/workflows';
import { attentionEntryOf } from './attentionEntryOf';
import type { WorkspaceAttentionEntry } from './state';
import type { SetFn } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

let latestRequest = 0;

export const refreshWorkspaceAttention = ({ set }: FactoryParams) => {
  return async (): Promise<void> => {
    latestRequest += 1;
    const request = latestRequest;
    const rows = await invokeWorkspacesAttention();
    if (request !== latestRequest) {
      return;
    }
    const attentionFromDatabase: Record<string, WorkspaceAttentionEntry> = {};
    for (const row of rows) {
      attentionFromDatabase[row.workspaceId] = attentionEntryOf({ row });
    }
    set({ attentionFromDatabase });
  };
};
