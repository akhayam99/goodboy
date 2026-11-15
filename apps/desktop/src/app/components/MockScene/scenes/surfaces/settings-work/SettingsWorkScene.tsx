import { useEffect } from 'react';
import { Band } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { WorkSwitchField } from '../../../../../../features/settings/components/SettingsStudio/WorkSwitchField';
import { SETTING_WORK_ENABLED } from '../../../../../../shared/lib/workSetting';

type Props = {
  readonly isOn: boolean;
};

export const SettingsWorkScene = ({ isOn }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme: 'dark' });
    useAppStore.setState((state) => ({
      settings: { ...state.settings, [SETTING_WORK_ENABLED]: isOn ? 'true' : 'false' },
    }));
  }, [isOn]);

  return (
    <main className="flex h-screen w-screen flex-col gap-6 bg-background p-10 text-foreground">
      <Band inset="content" label="Experiments" headingLevel={2}>
        <div className="flex max-w-2xl flex-col">
          <WorkSwitchField />
        </div>
      </Band>
    </main>
  );
};

export const SETTINGS_WORK_SCENES = {
  'settings-work': () => <SettingsWorkScene isOn={false} />,
};
