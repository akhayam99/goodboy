import { useCallback, useEffect, type ComponentType } from 'react';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { SETTING_AUTO_EXPERIMENT } from '../../../../../features/settings/settings';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';
import { installSceneDatabase } from '../sceneDatabase';

type SceneState = {
  readonly isOn: boolean;
  readonly runningCount?: number;
};

type Props = {
  readonly state: SceneState;
};

const seedExperiment = ({ isOn, runningCount = 0 }: SceneState): void => {
  const value = isOn ? 'true' : 'false';
  installSceneDatabase({
    settings: { [SETTING_AUTO_EXPERIMENT]: value },
    liveAutoTrees: runningCount,
  });
  useAppStore.setState((current) => ({
    settings: { ...current.settings, [SETTING_AUTO_EXPERIMENT]: value },
  }));
};

const SCROLL_DELAY_MS = 120;

const AutoSettingsScene = ({ state }: Props) => {
  const seed = useCallback(() => seedExperiment(state), [state]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      document.querySelector('[aria-label="Auto agent"]')?.scrollIntoView({ block: 'center' });
    }, SCROLL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <AutoReleaseContext.Provider value>
      <SettingsFrame focus={{ scope: 'app', section: 'general' }} seed={seed} />
    </AutoReleaseContext.Provider>
  );
};

export const U24_AUTO_SETTINGS_SCENES: Readonly<Record<string, ComponentType>> = {
  'auto-settings-experiment-off': () => <AutoSettingsScene state={{ isOn: false }} />,
  'auto-settings-experiment-off-running': () => (
    <AutoSettingsScene state={{ isOn: false, runningCount: 2 }} />
  ),
  'auto-settings-experiment-on': () => <AutoSettingsScene state={{ isOn: true }} />,
};
