import { useCallback, useEffect } from 'react';
import { useAppStore } from '../../../store';
import { SETTING_CLASSIFY_REQUESTS } from '../../../features/settings/settings';

export type ClassifyRequestsModel = Readonly<{
  isOn: boolean;
  setIsOn: (next: boolean) => void;
}>;

export const useClassifyRequests = (): ClassifyRequestsModel => {
  const raw = useAppStore((state) => state.settings[SETTING_CLASSIFY_REQUESTS]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    loadSetting(SETTING_CLASSIFY_REQUESTS).catch((error: unknown) => {
      void reportError({ title: "Couldn't read the request classifier", error });
    });
  }, [raw, loadSetting, reportError]);

  const setIsOn = useCallback(
    (isNext: boolean) => {
      saveSetting(SETTING_CLASSIFY_REQUESTS, isNext ? 'true' : 'false').catch((error: unknown) => {
        void reportError({ title: "Couldn't save the request classifier", error });
      });
    },
    [saveSetting, reportError],
  );

  return { isOn: raw === 'true', setIsOn };
};
