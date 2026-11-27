import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../../../store';
import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { HOME_TIPS, type HomeTip, type TipDismiss } from '../../tips/homeTips';
import { homeTipKey } from '../../tips/homeTipKey';

const DISMISSED = '1';

type HomeTipState = {
  readonly tip: HomeTip | null;
  readonly failedTipId: string | null;
  readonly dismiss: (params: TipDismiss) => void;
};

const SEPARATOR = ',';

type SettingsParams = {
  readonly settings: Readonly<Record<string, string>>;
};

const dismissedKeys = ({ settings }: SettingsParams): string =>
  HOME_TIPS.filter((tip) => settings[homeTipKey({ tipId: tip.id })] === DISMISSED)
    .map((tip) => tip.id)
    .join(SEPARATOR);

export const useHomeTip = (): HomeTipState => {
  const dismissed = useAppStore((state) => dismissedKeys({ settings: state.settings }));
  const [isLoaded, setIsLoaded] = useState(false);
  const [openedTipId, setOpenedTipId] = useState<string | null>(null);
  const [failedTipId, setFailedTipId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const { loadSetting, reportError } = useAppStore.getState();
    Promise.all(HOME_TIPS.map((tip) => loadSetting(homeTipKey({ tipId: tip.id }))))
      .then(() => {
        if (isCurrent) {
          setIsLoaded(true);
        }
      })
      .catch((error: unknown) =>
        reportError({
          recovery: READ_FAILED,
          title: "Couldn't read which tips you closed",
          error,
          severity: 'warning',
        }),
      );
    return () => {
      isCurrent = false;
    };
  }, []);

  const dismissedIds = dismissed === '' ? [] : dismissed.split(SEPARATOR);
  const firstOpen = HOME_TIPS.find((tip) => !dismissedIds.includes(tip.id)) ?? null;
  useEffect(() => {
    if (isLoaded && openedTipId === null && firstOpen !== null) {
      setOpenedTipId(firstOpen.id);
    }
  }, [isLoaded, openedTipId, firstOpen]);

  const dismiss = useCallback(({ tipId }: TipDismiss): void => {
    useAppStore
      .getState()
      .saveSetting(homeTipKey({ tipId }), DISMISSED)
      .then(() => setFailedTipId(null))
      .catch(() => setFailedTipId(tipId));
  }, []);

  const tip =
    isLoaded && openedTipId !== null && !dismissedIds.includes(openedTipId)
      ? (HOME_TIPS.find((candidate) => candidate.id === openedTipId) ?? null)
      : null;
  return { tip, failedTipId, dismiss };
};
