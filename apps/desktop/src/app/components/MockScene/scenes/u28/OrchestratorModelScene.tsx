import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { C09OrchestratedScene } from '../u25/C09OrchestratedScene';
import { SCENE_PROVIDERS } from './sceneProviders';

export const OrchestratorModelScene = () => {
  useEffect(() => {
    useAppStore.setState({ providers: SCENE_PROVIDERS });
  }, []);
  return <C09OrchestratedScene state="running" page="document" click="model" isRouted />;
};
