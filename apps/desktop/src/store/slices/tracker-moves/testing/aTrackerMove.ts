import { brandId, type WorkspaceId } from '@goodboy/types';
import type { TrackerMove } from '../types';

export const aTrackerMove = (): TrackerMove => ({
  key: 'linear:issue-412',
  provider: 'linear',
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  projectId: null,
  externalId: 'issue-412',
  identifier: 'HBL-412',
  title: 'Retried webhooks post a second credit',
  fromName: 'In Progress',
  toName: 'Done',
  target: { kind: 'linear', stateId: 'state-done', fromStateId: 'state-progress' },
});
