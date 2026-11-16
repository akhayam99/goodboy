import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ConnectionsStudio } from '../../../../../features/connections/components/ConnectionsStudio';
import type { ConnectionsFocus } from '../../../../../features/connections/connectionsFocus';
import { useAppStore } from '../../../../../store';
import { SETTINGS_WORKSPACE, seedSettingsBase } from './settingsSeed';
import { StudioFrame } from '../../../StudioFrame';
import { StudioFrame as SceneStudioFrame } from '../StudioFrame';
import { installSettingsInvokeMocks } from './installSettingsInvokeMocks';

const noop = () => undefined;

type Props = {
  readonly focus: ConnectionsFocus | null;
  readonly hasWorkspace?: boolean;
  readonly seed?: () => void;
};

export const ConnectionsFrame = ({ focus, hasWorkspace = true, seed = noop }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [initial] = useState(focus);
  const studio = useAppStore((state) => state.appStudio);
  const current = studio?.kind === 'connections' ? (studio.focus ?? null) : initial;
  useEffect(() => {
    installSettingsInvokeMocks();
    seedSettingsBase();
    seed();
    useAppStore.getState().switchStudio({ studio: { kind: 'connections', focus: initial } });
    setIsReady(true);
  }, [seed, initial]);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <SceneStudioFrame
        target={{ place: null, tool: null }}
        columnPlace="connections"
        main={
          <StudioFrame kind="connections" onClose={noop} placement="content">
            <ConnectionsStudio
              currentWorkspace={hasWorkspace ? SETTINGS_WORKSPACE : null}
              focus={current}
              onClose={noop}
            />
          </StudioFrame>
        }
      />
    </ToastProvider>
  );
};
