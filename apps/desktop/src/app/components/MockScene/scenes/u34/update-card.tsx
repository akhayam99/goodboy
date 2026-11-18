import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { toggleUpdateCard } from '../../../../../features/updater/updateCardRequest';
import { installSceneDatabase } from '../sceneDatabase';

const VERSION = '0.31.0';
const OPEN_MS = 300;

const UpdateCardAvailableScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase();
    useAppStore.setState({ updaterStatus: 'available', updateVersion: VERSION, updateNotes: null });
    setIsReady(true);
    const timer = window.setTimeout(toggleUpdateCard, OPEN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="relative flex overflow-hidden bg-background text-foreground"
      style={{ height: '100vh' }}
    >
      <ScenePlacesRail />
    </main>
  );
};

export const U34_UPDATE_CARD_SCENES = {
  'u34-u27-update-card': UpdateCardAvailableScene,
};
