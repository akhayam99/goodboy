import type { MountId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { selectWritableMounts } from '../../project-mounts/selectors';
import { inheritedMountIdOf } from './inheritedMountIdOf';

type State = Pick<AppState, 'sessionMounts' | 'sessionProjectMounts' | 'sessionPhaseRuns'>;

type Params = Readonly<{
  state: State;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  namedMountId?: string | null;
}>;

export const selectRunStepMountId = ({
  state,
  sessionId,
  workflowRunId,
  namedMountId,
}: Params): MountId | null => {
  const named =
    namedMountId == null
      ? undefined
      : selectWritableMounts({ state, sessionId }).find((mount) => mount.mountId === namedMountId);
  if (named !== undefined) {
    return named.mountId;
  }
  return inheritedMountIdOf({
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    workflowRunId,
  });
};
