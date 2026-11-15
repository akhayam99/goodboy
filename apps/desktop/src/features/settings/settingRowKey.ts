import type { WorkspaceId } from '@goodboy/types';

type Params = {
  readonly workspaceId: WorkspaceId | null;
  readonly row: string;
};

export const settingRowKey = ({ workspaceId, row }: Params): string =>
  workspaceId === null ? `app:${row}` : `workspace:${workspaceId}:${row}`;
