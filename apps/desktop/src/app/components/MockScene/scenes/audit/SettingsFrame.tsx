import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { SettingsStudio } from '../../../../../features/settings/components/SettingsStudio';
import type {
  SettingsFocus,
  SettingsScopeChange,
} from '../../../../../features/settings/settingsFocus';
import { SETTINGS_WORKSPACE, seedSettingsBase } from './settingsSeed';
import { SettingsToastProbe } from './SettingsToastProbe';
import { StudioFrame } from '../../../StudioFrame';
import { StudioFrame as SceneStudioFrame } from '../StudioFrame';
import { installSettingsInvokeMocks } from './installSettingsInvokeMocks';

const noop = () => undefined;

type Props = {
  readonly focus: SettingsFocus;
  readonly hasWorkspace?: boolean;
  readonly seed?: () => void;
};

export const SettingsFrame = ({ focus, hasWorkspace = true, seed = noop }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [current, setCurrent] = useState<SettingsFocus>(focus);
  const changeScope = (change: SettingsScopeChange) => setCurrent(change);
  useEffect(() => {
    installSettingsInvokeMocks();
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
        target={{ place: 'settings', tool: null }}
        main={(columnSlot) => (
          <StudioFrame
            kind="settings"
            onClose={noop}
            placement={columnSlot === null ? 'cover' : 'content'}
            isClosable={columnSlot === null}
          >
            <SettingsStudio
              currentWorkspace={hasWorkspace ? SETTINGS_WORKSPACE : null}
              focus={current}
              onScopeChange={changeScope}
              onClose={noop}
              columnSlot={columnSlot}
            />
          </StudioFrame>
        )}
      />
      <SettingsToastProbe />
    </ToastProvider>
  );
};
