import type { WorkspaceId } from '@goodboy/types';
import type { KickoffDraftKey } from './types';

export const kickoffDraftKey = ({
  workspaceId,
}: {
  readonly workspaceId: WorkspaceId;
}): KickoffDraftKey => `kickoff:${workspaceId}`;
