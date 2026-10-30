import { useMemo } from 'react';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectActiveMountId } from '../../../../store/slices/project-mounts/selectors';
import {
  selectMountBlockedStep,
  type MountBlockedStep,
} from '../../../../store/slices/workflows/runMount/selectMountBlockedStep';

type Params = Readonly<{
  sessionId: SessionId;
  workflowRunId: WorkflowRunId;
}>;

export const useMountBlockedStep = ({
  sessionId,
  workflowRunId,
}: Params): MountBlockedStep | null => {
  const phaseRuns = useAppStore((state) => state.sessionPhaseRuns[sessionId]);
  const mounts = useAppStore((state) => state.sessionMounts[sessionId]);
  const projectMounts = useAppStore((state) => state.sessionProjectMounts[sessionId]);
  const activeMountId = useAppStore((state) => selectActiveMountId({ state, sessionId }));
  return useMemo(
    () =>
      selectMountBlockedStep({
        state: {
          sessionPhaseRuns: phaseRuns === undefined ? {} : { [sessionId]: phaseRuns },
          sessionMounts: mounts === undefined ? {} : { [sessionId]: mounts },
          sessionProjectMounts: projectMounts === undefined ? {} : { [sessionId]: projectMounts },
        },
        sessionId,
        workflowRunId,
        activeMountId,
      }),
    [phaseRuns, mounts, projectMounts, activeMountId, sessionId, workflowRunId],
  );
};
