import { useEffect, useState } from 'react';
import {
  SETTING_UPDATER_SNOOZED_AT,
  SETTING_UPDATER_SNOOZED_VERSION,
} from '../../../settings/settings';
import { useAppStore } from '../../../../store';
import { shouldShowArrivalCard } from '../../updateSnoozeGate';

export const useUpdateArrivalCard = (): {
  readonly isVisible: boolean;
  readonly snooze: () => void;
} => {
  const status = useAppStore((state) => state.updaterStatus);
  const version = useAppStore((state) => state.updateVersion);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const [snoozedVersion, setSnoozedVersion] = useState<string | null>(null);
  const [snoozedAt, setSnoozedAt] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const isReady = status === 'ready';

  useEffect(() => {
    if (!isReady || isHydrated) {
      return;
    }
    void Promise.all([
      loadSetting(SETTING_UPDATER_SNOOZED_VERSION),
      loadSetting(SETTING_UPDATER_SNOOZED_AT),
    ]).then(([storedVersion, storedAt]) => {
      setSnoozedVersion(storedVersion);
      setSnoozedAt(storedAt);
      setIsHydrated(true);
    });
  }, [isReady, isHydrated, loadSetting]);

  const isVisible =
    isReady &&
    isHydrated &&
    shouldShowArrivalCard({ version, snoozedVersion, snoozedAt, nowMs: Date.now() });

  const snooze = (): void => {
    if (version === null) {
      return;
    }
    const now = new Date().toISOString();
    setSnoozedVersion(version);
    setSnoozedAt(now);
    void saveSetting(SETTING_UPDATER_SNOOZED_VERSION, version);
    void saveSetting(SETTING_UPDATER_SNOOZED_AT, now);
  };

  return { isVisible, snooze };
};
