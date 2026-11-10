import { useEffect } from 'react';
import { linksOpenOf } from '../../lib/linksOpenOf';
import { SETTING_LINKS_OPEN, type LinksOpen } from '../../lib/linksOpenSetting';
import { useAppStore } from '../../../store';
import { READ_FAILED } from '../../../store/slices/notifications/errorRecovery';

export const useLinksOpen = (): LinksOpen => {
  const raw = useAppStore((state) => state.settings[SETTING_LINKS_OPEN]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    loadSetting(SETTING_LINKS_OPEN).catch((error: unknown) => {
      void reportError({
        title: "Couldn't read where links open",
        error,
        recovery: READ_FAILED,
        severity: 'warning',
      });
    });
  }, [raw, loadSetting, reportError]);

  return linksOpenOf({ raw });
};
