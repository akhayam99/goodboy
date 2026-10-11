import { useEffect, useState, type ComponentType } from 'react';
import { useAppStore } from '../../../../../store';
import { GoodboyChip } from '../../../GoodboyChip';
import { installSceneDatabase } from '../sceneDatabase';

const SIDEBAR_WIDTH_PX = 240;
const NARROW_WINDOW = { width: 900, height: 600 } as const;
const VERSION = '0.24.1';
const LONG_VERSION = '0.24.1-beta.20261010.preview.build.8f3c2a91e7d54b6fa0c1d2e3f4a5b6c7d8e9f0';

const ROWS: ReadonlyArray<string> = [
  'Reconcile the ledger export',
  'Paginate the payments list',
  'Retry failed notify-relay sends',
];

const noop = () => undefined;

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
      <aside
        aria-label="Sidebar"
        className="flex min-h-0 translate-x-0 flex-col justify-between overflow-hidden border-r border-border bg-background p-2"
        style={{ width: SIDEBAR_WIDTH_PX }}
      >
        <ul className="flex flex-col gap-1">
          {ROWS.map((row) => (
            <li key={row} className="truncate px-2 py-1 text-label text-muted-foreground">
              {row}
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 items-center">
          <GoodboyChip
            variant="column"
            onOpenChangelog={noop}
            onOpenGuide={noop}
            onOpenShortcuts={noop}
          />
        </div>
      </aside>
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
