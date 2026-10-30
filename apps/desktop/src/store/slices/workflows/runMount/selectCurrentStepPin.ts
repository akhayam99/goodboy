import { isAgentStatusSettled, runsForWorkflowRun } from '@goodboy/core';
import type { MountId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { projectById } from '../../projects/projectIndex';
import { selectWritableMounts } from '../../project-mounts/selectors';
import {
  resolveWriteDestination,
  writeDestinationLabel,
} from '../../project-mounts/writeDestination';
import { pinnedMountIdOf } from './pinnedMountIdOf';

type State = Pick<
  AppState,
  'projects' | 'sessionMounts' | 'sessionProjectMounts' | 'sessionPhaseRuns'
>;

type Params = Readonly<{
  state: State;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId;
  activeMountId: MountId | null;
}>;

export type StepPin = Readonly<{
  mountId: MountId;
  label: string;
  isAvailable: boolean;
  isOffActive: boolean;
}>;

const UNKNOWN_BRANCH = 'the branch the run started on';

export const selectCurrentStepPin = ({
  state,
  sessionId,
  workflowRunId,
  activeMountId,
}: Params): StepPin | null => {
  const roots = runsForWorkflowRun(state.sessionPhaseRuns[sessionId] ?? [], workflowRunId)
    .filter((agent) => agent.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal);
  const current =
    roots.find((agent) => !isAgentStatusSettled({ status: agent.status })) ?? roots.at(-1);
  if (current === undefined) {
    return null;
  }
  const mountId = pinnedMountIdOf({ state, sessionId, agent: current });
  if (mountId === null) {
    return null;
  }
  const mount = selectWritableMounts({ state, sessionId }).find(
    (candidate) => candidate.mountId === mountId,
  );
  const isOffActive = activeMountId !== null && activeMountId !== mountId;
  if (mount === undefined) {
    const branch = (state.sessionMounts?.[sessionId] ?? []).find(
      (view) => view.id === mountId,
    )?.branch;
    return {
      mountId,
      label: branch === undefined || branch === '' ? UNKNOWN_BRANCH : branch,
      isAvailable: false,
      isOffActive,
    };
  }
  return {
    mountId,
    label: writeDestinationLabel(
      resolveWriteDestination({
        mount,
        projectName: projectById(state.projects, mount.projectId)?.name ?? null,
        scratchPath: null,
      }),
    ),
    isAvailable: true,
    isOffActive,
  };
};
