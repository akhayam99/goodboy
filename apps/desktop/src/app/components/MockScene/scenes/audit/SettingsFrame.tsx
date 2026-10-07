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
import { sceneShellMode } from '../sceneShell';

const noop = () => undefined;

const IS_COLUMN_SHELL = sceneShellMode() === 'column';

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
            placement={IS_COLUMN_SHELL ? 'content' : 'cover'}
            isClosable={!IS_COLUMN_SHELL}
            hasBand={!IS_COLUMN_SHELL}
          >
            <SettingsStudio
              currentWorkspace={hasWorkspace ? SETTINGS_WORKSPACE : null}
              focus={current}
              onScopeChange={changeScope}
              onClose={noop}
              columnSlot={columnSlot}
              isInColumnShell={IS_COLUMN_SHELL}
            />
          </StudioFrame>
        )}
      />
      <SettingsToastProbe />
    </ToastProvider>
  );
};
