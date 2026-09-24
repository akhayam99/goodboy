import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../Toast';
import { SettingsStudio } from '../../../../../features/settings/components/SettingsStudio';
import type { SettingsFocus } from '../../../../../features/settings/components/SettingsStudio/types';
import { SETTINGS_WORKSPACE, seedSettingsBase } from './settingsSeed';
import { SettingsToastProbe } from './SettingsToastProbe';

const noop = () => undefined;

type Props = {
  readonly focus: SettingsFocus;
  readonly hasWorkspace?: boolean;
  readonly seed?: () => void;
};

export const SettingsFrame = ({ focus, hasWorkspace = true, seed = noop }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedSettingsBase();
    seed();
    setIsReady(true);
  }, [seed]);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <SettingsStudio
          currentWorkspace={hasWorkspace ? SETTINGS_WORKSPACE : null}
          focus={focus}
          onScopeChange={noop}
          onClose={noop}
        />
        <SettingsToastProbe />
      </main>
    </ToastProvider>
  );
};
