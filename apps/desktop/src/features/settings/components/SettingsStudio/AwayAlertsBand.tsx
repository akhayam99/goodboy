import { Band, Switch } from '@goodboy/ui';
import { useAwayAlertsStore } from '../../../notifications/away/awayAlertsStore';
import { SettingRow } from './SettingRow';

export const AwayAlertsBand = () => {
  const bannerChoice = useAwayAlertsStore((state) => state.bannerChoice);
  const isBadgeOn = useAwayAlertsStore((state) => state.isBadgeOn);
  const setBadge = useAwayAlertsStore((state) => state.setBadge);
  const setBannerChoice = useAwayAlertsStore((state) => state.setBannerChoice);

  return (
    <Band inset="content" label="Notifications" headingLevel={2}>
      <div className="flex flex-col">
        <SettingRow
          label="Banner when you are away"
          help="A system banner when an agent needs you and Goodboy is behind."
          isChanged={bannerChoice === 'on'}
          onReset={() => setBannerChoice({ choice: 'off' })}
        >
          <Switch
            ariaLabel="Banner when you are away"
            checked={bannerChoice === 'on'}
            onChange={(isNext) => setBannerChoice({ choice: isNext ? 'on' : 'off' })}
          />
        </SettingRow>
        <SettingRow
          label="Dock badge"
          help="The number of sessions that need you, on the app icon."
          isChanged={!isBadgeOn}
          onReset={() => setBadge({ isOn: true })}
        >
          <Switch
            ariaLabel="Dock badge"
            checked={isBadgeOn}
            onChange={(isNext) => setBadge({ isOn: isNext })}
          />
        </SettingRow>
      </div>
    </Band>
  );
};
