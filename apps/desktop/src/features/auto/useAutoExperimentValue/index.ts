import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store';
import { SETTING_AUTO_EXPERIMENT } from '../../settings/settings';
import { autoExperimentSettings } from '../autoExperimentSettings';

export const useAutoExperimentValue = (): Readonly<Record<string, string>> => {
  const raw = useAppStore((state) => state.settings[SETTING_AUTO_EXPERIMENT]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    const reload = () => {
      loadSetting(SETTING_AUTO_EXPERIMENT).catch((error: unknown) => {
        void reportError({ title: "Couldn't read the Auto setting", error });
      });
    };
    reload();
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [loadSetting, reportError]);

  return useMemo(() => autoExperimentSettings({ raw }), [raw]);
};
