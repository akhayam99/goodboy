import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../Toast';
import { SettingsStudio } from '../../../../../features/settings/components/SettingsStudio';
import type { SettingsFocus } from '../../../../../features/settings/settingsFocus';
import { SETTINGS_WORKSPACE, seedSettingsBase } from './settingsSeed';
import { SettingsToastProbe } from './SettingsToastProbe';
import { StudioFrame } from '../../../StudioFrame';
import { StudioFrame as SceneStudioFrame } from '../StudioFrame';

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
      <SceneStudioFrame
        target="settings"
        main={
          <StudioFrame kind="settings" onClose={noop}>
            <SettingsStudio
              currentWorkspace={hasWorkspace ? SETTINGS_WORKSPACE : null}
              focus={focus}
              onScopeChange={noop}
              onClose={noop}
            />
          </StudioFrame>
        }
      />
      <SettingsToastProbe />
    </ToastProvider>
  );
};
