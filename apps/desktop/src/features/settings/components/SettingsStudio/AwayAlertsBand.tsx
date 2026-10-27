import { Band, FieldRow, Switch } from '@goodboy/ui';
import { useAwayAlertsStore } from '../../../notifications/away/awayAlertsStore';

export const AwayAlertsBand = () => {
  const bannerChoice = useAwayAlertsStore((state) => state.bannerChoice);
  const isBadgeOn = useAwayAlertsStore((state) => state.isBadgeOn);
  const setBadge = useAwayAlertsStore((state) => state.setBadge);
  const setBannerChoice = useAwayAlertsStore((state) => state.setBannerChoice);

  return (
    <Band inset="content" label="Notifications" headingLevel={2}>
      <div className="flex flex-col">
        <FieldRow
          label="Banner when you are away"
          help="A system banner when an agent needs you and Goodboy is behind."
        >
          <Switch
            ariaLabel="Banner when you are away"
            checked={bannerChoice === 'on'}
            onChange={(isNext) => setBannerChoice({ choice: isNext ? 'on' : 'off' })}
          />
        </FieldRow>
        <FieldRow label="Dock badge" help="The number of sessions that need you, on the app icon.">
          <Switch
            ariaLabel="Dock badge"
            checked={isBadgeOn}
            onChange={(isNext) => setBadge({ isOn: isNext })}
          />
        </FieldRow>
      </div>
    </Band>
  );
};
