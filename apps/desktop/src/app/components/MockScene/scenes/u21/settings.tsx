import { useEffect, useState, type ComponentType } from 'react';
import type { SettingsFocus } from '../../../../../features/settings/settingsFocus';
import { useAppStore } from '../../../../../store';
import type { ShellMode } from '../../../../shellArrangement';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { installSettingsInvokeMocks } from '../audit/installSettingsInvokeMocks';
import { seedPolicyScene } from '../providerPolicySeed';

const OPEN_DELAY_MS = 30;

type FrameContext = 'board' | 'session' | 'rail';

type Props = {
  readonly context: FrameContext;
  readonly focus: SettingsFocus;
  readonly mode?: ShellMode;
  readonly hasLimits?: boolean;
};

const SettingsOverApp = ({ context, focus, mode = 'column', hasLimits = false }: Props) => {
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
      () => useAppStore.getState().switchStudio({ studio: { kind: 'settings', focus } }),
      OPEN_DELAY_MS,
    );
    return () => window.clearTimeout(id);
  }, [isReady]);

  if (!isReady) {
    return null;
  }
  return <AppFrame view="settings-over-app" isRailCollapsed={context === 'rail'} mode={mode} />;
};

const GENERAL: SettingsFocus = { scope: 'app', section: 'general' };

const CLAUDE_PAGE: SettingsFocus = { scope: 'providers', provider: 'anthropic' };

export const U21_SETTINGS_SCENES: Readonly<Record<string, ComponentType>> = {
  'settings-general-rail': () => <SettingsOverApp context="rail" focus={GENERAL} />,
  'settings-general-pinned': () => <SettingsOverApp context="session" focus={GENERAL} />,
  'settings-providers-rail': () => <SettingsOverApp context="rail" focus={CLAUDE_PAGE} hasLimits />,
  'settings-general-legacy': () => (
    <SettingsOverApp context="board" focus={GENERAL} mode="classic" />
  ),
};
