import type { WorkspaceId } from '@goodboy/types';
import type { KickoffDraftKey, KickoffLane } from './types';

export const kickoffDraftKey = ({
  workspaceId,
  lane = 'workflow',
}: {
  readonly workspaceId: WorkspaceId;
  readonly lane?: KickoffLane;
}): KickoffDraftKey => (lane === 'task' ? `kickoff-task:${workspaceId}` : `kickoff:${workspaceId}`);
