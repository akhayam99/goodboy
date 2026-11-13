import { useAppStore } from '../../store';
import { READ_FAILED } from '../../store/slices/notifications/errorRecovery';
import { linksOpenOf } from '../../shared/lib/linksOpenOf';
import { SETTING_LINKS_OPEN, type LinksOpen } from '../../shared/lib/linksOpenSetting';

export const readLinksOpen = async (): Promise<LinksOpen> => {
  const state = useAppStore.getState();
  const saved = state.settings[SETTING_LINKS_OPEN];
  if (saved !== undefined) {
    return linksOpenOf({ raw: saved });
  }
  try {
    return linksOpenOf({ raw: await state.loadSetting(SETTING_LINKS_OPEN) });
  } catch (error) {
    void state.reportError({
      title: "Couldn't read where links open",
      error,
      recovery: READ_FAILED,
      severity: 'warning',
    });
    return linksOpenOf({ raw: null });
  }
};
