import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { SETTING_CHAT_IMAGES } from '../../../settings/settings';

export const useChatImagesOn = (): boolean => {
  const raw = useAppStore((state) => state.settings[SETTING_CHAT_IMAGES]);
  const loadSetting = useAppStore((state) => state.loadSetting);

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    void loadSetting(SETTING_CHAT_IMAGES).catch(() => undefined);
  }, [raw, loadSetting]);

  return raw !== 'false';
};
