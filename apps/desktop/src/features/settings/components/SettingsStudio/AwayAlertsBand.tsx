import { useCallback } from 'react';
import { Band, Switch } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { useAwayAlertsStore } from '../../../notifications/away/awayAlertsStore';
import { useSettingSave } from '../../hooks/useSettingSave';
import { settingRowKey } from '../../settingRowKey';
import { SWITCH_SETTING } from '../../switchSetting';
import { SettingRow } from './SettingRow';

const BANNER_HELP = 'When an agent needs you and Goodboy is in the background.';
const BADGE_HELP = 'Sessions that need you, on the app icon.';

type ValueParams<Value> = {
  readonly value: Value;
};

const notStored = (): Error => new Error('This Mac did not keep the change.');

export const AwayAlertsBand = () => {
  const bannerChoice = useAwayAlertsStore((state) => state.bannerChoice);
  const isBadgeOn = useAwayAlertsStore((state) => state.isBadgeOn);
  const setBadge = useAwayAlertsStore((state) => state.setBadge);
  const setBannerChoice = useAwayAlertsStore((state) => state.setBannerChoice);

  const writeBanner = useCallback(
    async ({ value: isOn }: ValueParams<boolean>) => {
      if (!setBannerChoice({ choice: isOn ? 'on' : 'off' })) {
        throw notStored();
      }
    },
    [setBannerChoice],
  );
  const writeBadge = useCallback(
    async ({ value: isOn }: ValueParams<boolean>) => {
      if (!setBadge({ isOn })) {
        throw notStored();
      }
    },
    [setBadge],
  );
  const banner = useSettingSave({
    rowKey: settingRowKey({ workspaceId: null, row: 'awayBanner' }),
    saved: bannerChoice === 'on',
    write: writeBanner,
    display: SWITCH_SETTING.display,
    failureTitle: "Couldn't save the away banner",
  });
  const badge = useSettingSave({
    rowKey: settingRowKey({ workspaceId: null, row: 'awayBadge' }),
    saved: isBadgeOn,
    write: writeBadge,
    display: SWITCH_SETTING.display,
    failureTitle: "Couldn't save the dock badge",
  });

  return (
    <Band inset="content" label="Notifications" headingLevel={2}>
      <div className="flex flex-col">
        <SettingRow
          label={NAMES.bannerWhenAway}
          rowKey="away-banner"
          help={BANNER_HELP}
          isChanged={banner.value}
          onReset={() => void banner.save({ value: false })}
          save={banner}
        >
          <Switch
            ariaLabel={NAMES.bannerWhenAway}
            checked={banner.value}
            onChange={(isNext) => void banner.save({ value: isNext })}
          />
        </SettingRow>
        <SettingRow
          label="Dock badge"
          rowKey="dock-badge"
          help={BADGE_HELP}
          isChanged={!badge.value}
          onReset={() => void badge.save({ value: true })}
          save={badge}
        >
          <Switch
            ariaLabel="Dock badge"
            checked={badge.value}
            onChange={(isNext) => void badge.save({ value: isNext })}
          />
        </SettingRow>
      </div>
    </Band>
  );
};
