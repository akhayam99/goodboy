import { useEffect, useState, type ComponentType } from 'react';
import { useAppStore } from '../../../../../store';
import { APP_VERSION } from '../../../../../shared/lib/appVersion';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { installSceneDatabase } from '../sceneDatabase';

type NextPatchParams = {
  readonly version: string;
};

const nextPatchOf = ({ version }: NextPatchParams): string => {
  const [major = '0', minor = '0', patch = '0'] = version.split('-')[0]?.split('.') ?? [];
  return `${major}.${minor}.${Number.parseInt(patch, 10) + 1}`;
};

const NARROW_WINDOW = { width: 900, height: 600 } as const;
const VERSION = nextPatchOf({ version: APP_VERSION });
const LONG_VERSION = `${VERSION}-beta.20261010.preview.build.8f3c2a91e7d54b6fa0c1d2e3f4a5b6c7d8e9f0`;

type FrameProps = {
  readonly version: string;
  readonly size?: { readonly width: number; readonly height: number };
};

const UpdaterCardFrame = ({ version, size }: FrameProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase();
    useAppStore.setState({ updaterStatus: 'ready', updateVersion: version, updateNotes: null });
    setIsReady(true);
  }, [version]);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="relative flex overflow-hidden bg-background text-foreground"
      style={size === undefined ? { height: '100vh' } : size}
    >
      <ScenePlacesRail />
    </main>
  );
};

export const U24_UPDATER_CARD_SCENES: Readonly<Record<string, ComponentType>> = {
  'update-card': () => <UpdaterCardFrame version={VERSION} />,
  'update-card-narrow': () => <UpdaterCardFrame version={VERSION} size={NARROW_WINDOW} />,
  'update-card-long-version': () => (
    <UpdaterCardFrame version={LONG_VERSION} size={NARROW_WINDOW} />
  ),
};
