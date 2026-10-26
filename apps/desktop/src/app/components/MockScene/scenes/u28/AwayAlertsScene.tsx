import { useEffect } from 'react';
import { applyDocumentTheme, type Theme } from '../../../../../shared/lib/theme';
import { AwayAlertsBand } from '../../../../../features/settings/components/SettingsStudio/AwayAlertsBand';
import { useAwayAlertsStore } from '../../../../../features/notifications/away/awayAlertsStore';

type Props = {
  readonly theme: Theme;
  readonly bannerChoice: 'unasked' | 'on';
};

export const AwayAlertsScene = ({ theme, bannerChoice }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
    useAwayAlertsStore.setState({ isBadgeOn: true, bannerChoice });
  }, [theme, bannerChoice]);

  return (
    <main className="flex h-screen w-screen flex-col gap-6 bg-background p-10 text-foreground">
      <div className="w-[34rem]">
        <AwayAlertsBand />
      </div>
    </main>
  );
};

export const U28_AWAY_ALERTS_SCENES = {
  'u28-away-alerts-asked-dark': () => <AwayAlertsScene theme="dark" bannerChoice="unasked" />,
  'u28-away-alerts-on-dark': () => <AwayAlertsScene theme="dark" bannerChoice="on" />,
  'u28-away-alerts-on-light': () => <AwayAlertsScene theme="light" bannerChoice="on" />,
};
