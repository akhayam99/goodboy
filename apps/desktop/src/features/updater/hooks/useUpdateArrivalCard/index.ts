import { useEffect, useState } from 'react';
import {
  SETTING_UPDATER_SNOOZED_AT,
  SETTING_UPDATER_SNOOZED_VERSION,
} from '../../../settings/settings';
import { useAppStore } from '../../../../store';
import type { UpdateCardState } from '../../updateCardState';
import { TOGGLE_UPDATE_CARD_EVENT } from '../../updateCardRequest';
import { shouldShowArrivalCard } from '../../updateSnoozeGate';

type Params = {
  readonly state: UpdateCardState | null;
};

const ARRIVING_STATES: ReadonlySet<UpdateCardState> = new Set(['ready', 'running', 'failed']);

export const useUpdateArrivalCard = ({
  state,
}: Params): {
  readonly isVisible: boolean;
  readonly snooze: () => void;
} => {
  const version = useAppStore((store) => store.updateVersion);
  const loadSetting = useAppStore((store) => store.loadSetting);
  const saveSetting = useAppStore((store) => store.saveSetting);
  const [snoozedVersion, setSnoozedVersion] = useState<string | null>(null);
  const [snoozedAt, setSnoozedAt] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const isArriving = state !== null && ARRIVING_STATES.has(state);
  const hasCard = state !== null;

  useEffect(() => {
    if (!isArriving || isHydrated) {
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
  }, [isArriving, isHydrated, loadSetting]);

  useEffect(() => {
    if (hasCard) {
      return;
    }
    setIsRequested(false);
  }, [hasCard]);

  const isArrivalShown =
    isArriving &&
    isHydrated &&
    shouldShowArrivalCard({ version, snoozedVersion, snoozedAt, nowMs: Date.now() });
  const isVisible = hasCard && (isRequested || isArrivalShown);

  const snooze = (): void => {
    setIsRequested(false);
    if (version === null) {
      return;
    }
    const now = new Date().toISOString();
    setSnoozedVersion(version);
    setSnoozedAt(now);
    setIsHydrated(true);
    void saveSetting(SETTING_UPDATER_SNOOZED_VERSION, version);
    void saveSetting(SETTING_UPDATER_SNOOZED_AT, now);
  };

  useEffect(() => {
    const onToggle = (): void => {
      if (!hasCard) {
        return;
      }
      if (isVisible) {
        snooze();
        return;
      }
      setIsRequested(true);
    };
    window.addEventListener(TOGGLE_UPDATE_CARD_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_UPDATE_CARD_EVENT, onToggle);
  });

  return { isVisible, snooze };
};
