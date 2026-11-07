import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import { useAppStore } from '../../store';
import { foldAutoLimitOfWorkspace } from './foldAutoLimitOfWorkspace';

export const foldAutoLimitsAtBoot = async (): Promise<void> => {
  const { workspaces, reportError } = useAppStore.getState();
  await Promise.all(
    workspaces
      .filter((workspace) => workspace.deletedAt === undefined)
      .map((workspace) =>
        foldAutoLimitOfWorkspace({ workspaceId: workspace.id }).catch((error: unknown) =>
          reportError({
            recovery: CHECK_STATE,
            title: "Couldn't move the Auto limit into the run defaults",
            error,
            workspaceId: workspace.id,
          }),
        ),
      ),
  );
};
