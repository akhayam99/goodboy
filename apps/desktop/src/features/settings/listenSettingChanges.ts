import { listenDataChanged } from '../../shared/lib/dataChanged';
import { useAppStore } from '../../store';

export const listenSettingChanges = (): Promise<() => void> =>
  listenDataChanged({
    onChange: ({ kind, key }) => {
      if (kind !== 'setting') {
        return;
      }
      const state = useAppStore.getState();
      state.loadSetting(key).catch((error: unknown) =>
        state.reportError({
          title: "Couldn't read a setting saved in another window",
          error,
          severity: 'warning',
        }),
      );
    },
  });
