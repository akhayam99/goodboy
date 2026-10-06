import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import { SETTING_SHELL_CLASSIC_BARS } from '../../../features/settings/settings';

export const useClassicBars = (): boolean => {
  const raw = useAppStore((state) => state.settings[SETTING_SHELL_CLASSIC_BARS]);
  const loadSetting = useAppStore((state) => state.loadSetting);

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    void loadSetting(SETTING_SHELL_CLASSIC_BARS).catch(() => undefined);
  }, [raw, loadSetting]);

  return raw === 'true';
};
