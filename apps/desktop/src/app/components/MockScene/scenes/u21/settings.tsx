import { useEffect, useState, type ComponentType } from 'react';
import { useAppStore, type StudioPlace } from '../../../../../store';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { installSettingsInvokeMocks } from '../audit/installSettingsInvokeMocks';
import { seedPolicyScene } from '../providerPolicySeed';

const OPEN_DELAY_MS = 30;

type FrameContext = 'board' | 'session' | 'rail';

type Props = {
  readonly context: FrameContext;
  readonly focus: StudioPlace;
  readonly hasLimits?: boolean;
};

const SettingsOverApp = ({ context, focus, hasLimits = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSettingsInvokeMocks();
    seedFrame({ context });
    const workspaceId = useAppStore.getState().currentWorkspaceId;
    if (hasLimits && workspaceId !== null) {
      seedPolicyScene({ workspaceId });
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const id = window.setTimeout(
      () => useAppStore.getState().switchStudio({ studio: focus }),
      OPEN_DELAY_MS,
    );
    return () => window.clearTimeout(id);
  }, [isReady]);

  if (!isReady) {
    return null;
  }
  return <AppFrame view="settings-over-app" />;
};

const GENERAL: StudioPlace = { kind: 'settings', focus: { scope: 'app', section: 'general' } };

const CLAUDE_PAGE: StudioPlace = {
  kind: 'connections',
  focus: { kind: 'provider', provider: 'anthropic' },
};

export const U21_SETTINGS_SCENES: Readonly<Record<string, ComponentType>> = {
  'settings-general-pinned': () => <SettingsOverApp context="session" focus={GENERAL} />,
  'settings-providers-rail': () => <SettingsOverApp context="rail" focus={CLAUDE_PAGE} hasLimits />,
};
