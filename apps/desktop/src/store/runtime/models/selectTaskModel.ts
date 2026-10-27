import type { AuxTaskId, SessionId, TaskModelPreference, WorkspaceId } from '@goodboy/types';
import { resolutionAsTask } from '../../../features/providers/resolutionAsTask';
import type { ModelState } from './selectModelContext';
import { selectResolution } from './selectResolution';

type Params = {
  readonly state: ModelState;
  readonly task: AuxTaskId;
  readonly sessionId?: SessionId | null;
  readonly workspaceId?: WorkspaceId | null;
};

export const selectTaskModel = ({
  state,
  task,
  sessionId = null,
  workspaceId = null,
}: Params): TaskModelPreference =>
  resolutionAsTask({
    resolution: selectResolution({
      state,
      sessionId,
      workspaceId,
      slot: { kind: 'task', id: task },
    }),
  });
