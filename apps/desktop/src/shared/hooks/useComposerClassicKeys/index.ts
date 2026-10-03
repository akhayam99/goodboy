import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import { SETTING_COMPOSER_CLASSIC_KEYS } from '../../../features/settings/settings';

type Params = {
  readonly isEnabled: boolean;
};

export const useComposerClassicKeys = ({ isEnabled }: Params): boolean => {
  const raw = useAppStore((state) =>
    isEnabled ? state.settings[SETTING_COMPOSER_CLASSIC_KEYS] : undefined,
  );
  const loadSetting = useAppStore((state) => state.loadSetting);

  useEffect(() => {
    if (!isEnabled || raw !== undefined) {
      return;
    }
    void loadSetting(SETTING_COMPOSER_CLASSIC_KEYS).catch(() => undefined);
  }, [isEnabled, raw, loadSetting]);

  return isEnabled && raw === 'true';
};
