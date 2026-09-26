import type { ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';

export type ToolStatus = 'running' | 'done' | 'failed' | 'approval' | 'stopped' | 'denied';

export type PermissionState = {
  readonly requested: boolean;
  readonly decision: 'allow' | 'deny' | null;
};

const NO_PERMISSION: PermissionState = { requested: false, decision: null };

type PermissionForParams = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly toolUseId: string;
};

export const permissionFor = ({ items, toolUseId }: PermissionForParams): PermissionState => {
  let requested = false;
  let decision: 'allow' | 'deny' | null = null;
  for (const item of items) {
    if (item.kind === 'permission_request' && item.toolUseId === toolUseId) {
      requested = true;
    }
    if (item.kind === 'permission_decision' && item.toolUseId === toolUseId) {
      decision = item.decision;
    }
  }
  return requested || decision !== null ? { requested, decision } : NO_PERMISSION;
};

type ToolStatusParams = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
  readonly activeRunId?: ProviderRunId | null;
  readonly permission?: PermissionState;
};

export const toolStatus = ({
  item,
  activeRunId,
  permission = NO_PERMISSION,
}: ToolStatusParams): ToolStatus => {
  if (permission.decision === 'deny') {
    return 'denied';
  }
  if (item.ended) {
    return item.isError ? 'failed' : 'done';
  }
  if (permission.requested && permission.decision === null) {
    return 'approval';
  }
  if (activeRunId !== undefined && (activeRunId === null || activeRunId !== item.runId)) {
    return 'stopped';
  }
  return 'running';
};
