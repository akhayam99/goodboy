import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { SETTING_OVERVIEW_LAYOUT } from '../../../settings/settings';
import { overviewLayoutOf, type OverviewLayout } from '../overviewLayoutOf';

export const useOverviewLayout = (): OverviewLayout => {
  const raw = useAppStore((state) => state.settings[SETTING_OVERVIEW_LAYOUT]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    const reload = () => {
      loadSetting(SETTING_OVERVIEW_LAYOUT).catch((error: unknown) => {
        void reportError({ title: "Couldn't read the overview setting", error });
      });
    };
    reload();
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [loadSetting, reportError]);

  return overviewLayoutOf({ raw });
};
