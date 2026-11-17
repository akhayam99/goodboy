import { READ_FAILED } from '../../store/slices/notifications/errorRecovery';
import { listenDataChanged } from '../../shared/lib/dataChanged';
import { useAppStore } from '../../store';

const READ_TITLE = "Couldn't read a setting saved in another window";

export const listenSettingChanges = (): Promise<() => void> =>
  listenDataChanged({
    onChange: ({ kind, key, workspaceId }) => {
      const state = useAppStore.getState();
      if (kind === 'workspace') {
        const read =
          key === 'overrides'
            ? state.loadWorkspaceOverrides(workspaceId)
            : state.loadWorkspaceValue({ workspaceId, key });
        read.catch((error: unknown) =>
          state.reportError({
            recovery: READ_FAILED,
            title: READ_TITLE,
            error,
            severity: 'warning',
            workspaceId,
          }),
        );
        return;
      }
      if (kind !== 'setting') {
        return;
      }
      state.loadSetting(key).catch((error: unknown) =>
        state.reportError({
          recovery: READ_FAILED,
          title: READ_TITLE,
          error,
          severity: 'warning',
        }),
      );
    },
  });
