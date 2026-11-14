import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import { SETTING_WORK_ENABLED } from '../../lib/workSetting';

export const useIsWorkOn = (): boolean => {
  const raw = useAppStore((state) => state.settings[SETTING_WORK_ENABLED]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    loadSetting(SETTING_WORK_ENABLED).catch((error: unknown) =>
      reportError({
        title: "Couldn't read the Work setting",
        error,
        recovery: CHECK_STATE,
        severity: 'warning',
      }),
    );
  }, [raw, loadSetting, reportError]);

  return raw === 'true';
};
