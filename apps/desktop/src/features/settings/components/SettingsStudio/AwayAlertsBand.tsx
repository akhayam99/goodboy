import { useCallback } from 'react';
import { Band, FieldRow, Switch } from '@goodboy/ui';
import { useAwayAlertsStore } from '../../../notifications/away/awayAlertsStore';
import { useSettingSave } from '../../hooks/useSettingSave';
import { settingRowKey } from '../../settingRowKey';
import { SWITCH_SETTING } from '../../switchSetting';
import { SaveErrorHelp } from './SaveErrorHelp';

const BANNER_HELP = 'A system banner when an agent needs you and Goodboy is behind.';
const BADGE_HELP = 'The number of sessions that need you, on the app icon.';

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
    async ({ value }: ValueParams<boolean>) => {
      if (!setBannerChoice({ choice: value ? 'on' : 'off' })) {
        throw notStored();
      }
    },
    [setBannerChoice],
  );
  const writeBadge = useCallback(
    async ({ value }: ValueParams<boolean>) => {
      if (!setBadge({ isOn: value })) {
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
        <FieldRow
          label="Banner when you are away"
          help={
            banner.error === null ? BANNER_HELP : <SaveErrorHelp help={BANNER_HELP} save={banner} />
          }
        >
          <Switch
            ariaLabel="Banner when you are away"
            checked={banner.value}
            onChange={(isNext) => void banner.save({ value: isNext })}
          />
        </FieldRow>
        <FieldRow
          label="Dock badge"
          help={
            badge.error === null ? BADGE_HELP : <SaveErrorHelp help={BADGE_HELP} save={badge} />
          }
        >
          <Switch
            ariaLabel="Dock badge"
            checked={badge.value}
            onChange={(isNext) => void badge.save({ value: isNext })}
          />
        </FieldRow>
      </div>
    </Band>
  );
};
