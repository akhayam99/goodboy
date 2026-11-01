import { useAppStore, useSessionById } from '../../store';
import {
  BLOCKED_MOUNT_RUN_ID,
  BLOCKED_MOUNT_SESSION_ID,
} from '../../app/components/MockScene/scenes/u30/blockedMountStepSeed';
import { StoppedPresetTail } from './StoppedPresetTail';

export const StoppedPresetScene = () => {
  const session = useSessionById(BLOCKED_MOUNT_SESSION_ID);
  const run = session?.workflowRuns.find((candidate) => candidate.id === BLOCKED_MOUNT_RUN_ID);
  const workflow = useAppStore((state) =>
    (state.sessionWorkflows[BLOCKED_MOUNT_SESSION_ID] ?? []).find(
      (candidate) => candidate.id === run?.workflowId,
    ),
  );
  if (session == null || run === undefined || workflow === undefined) {
    return null;
  }
  return <StoppedPresetTail session={session} run={run} workflow={workflow} />;
};
