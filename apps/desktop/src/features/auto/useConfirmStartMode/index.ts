import { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import { SETTING_AUTO_EXPERIMENT } from '../../settings/settings';
import { readIsAutoOn } from '../readIsAutoOn';
import { useIsAutoReleased } from '../useIsAutoReleased';

type Params = {
  readonly isShown: boolean;
};

export type ConfirmStartMode = (params: Params) => Promise<boolean>;

export const useConfirmStartMode = (): ConfirmStartMode => {
  const isReleased = useIsAutoReleased();
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);

  return useCallback(
    async ({ isShown }: Params): Promise<boolean> => {
      try {
        const isOn = await readIsAutoOn({ db: tauriDatabase, isReleased });
        if (isOn === isShown) {
          return true;
        }
        await loadSetting(SETTING_AUTO_EXPERIMENT);
        return false;
      } catch (error) {
        await reportError({ title: "Couldn't read the Auto setting", error });
        return false;
      }
    },
    [isReleased, loadSetting, reportError],
  );
};
