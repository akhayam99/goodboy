import type { MountId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { selectWritableMounts } from '../../project-mounts/selectors';

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
  if (workflowRunId === null) {
    return null;
  }
  const previous = (state.sessionPhaseRuns[sessionId] ?? [])
    .filter((agent) => agent.workflowRunId === workflowRunId && agent.mountId != null)
    .sort((left, right) => right.ordinal - left.ordinal)[0];
  return previous?.mountId ?? null;
};
