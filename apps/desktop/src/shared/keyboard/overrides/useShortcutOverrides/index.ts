import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { SETTING_SHORTCUT_OVERRIDES } from '../../../../features/settings/settings';
import { parseShortcutOverrides } from '../parseShortcutOverrides';
import { setShortcutOverrides } from '../setShortcutOverrides';

export const useShortcutOverrides = (): Readonly<Record<string, string>> => {
  const raw = useAppStore((state) => state.settings[SETTING_SHORTCUT_OVERRIDES]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    void loadSetting(SETTING_SHORTCUT_OVERRIDES).catch((error: unknown) =>
      reportError({ title: "Couldn't read your shortcut keys", error }),
    );
  }, [raw, loadSetting, reportError]);

  return useMemo(() => {
    const parsed = parseShortcutOverrides({ raw });
    setShortcutOverrides({ overrides: parsed });
    return parsed;
  }, [raw]);
};
