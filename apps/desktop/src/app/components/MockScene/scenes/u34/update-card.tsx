import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { GoodboyChip } from '../../../GoodboyChip';
import { ReportBugButton } from '../../../SideColumn/ReportBugButton';
import { toggleUpdateCard } from '../../../../../features/updater/updateCardRequest';
import { installSceneDatabase } from '../sceneDatabase';

const SIDEBAR_WIDTH_PX = 240;
const VERSION = '0.31.0';
const OPEN_MS = 300;

const noop = () => undefined;

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
      <aside
        aria-label="Sidebar"
        className="flex min-h-0 flex-col justify-end overflow-hidden border-r border-border bg-background p-2"
        style={{ width: SIDEBAR_WIDTH_PX }}
      >
        <div className="@container flex min-w-0 items-center gap-1">
          <GoodboyChip
            variant="column"
            isCurrent={false}
            onOpenChangelog={noop}
            onOpenHelp={noop}
          />
          <ReportBugButton />
        </div>
      </aside>
    </main>
  );
};

export const U34_UPDATE_CARD_SCENES = {
  'u34-u27-update-card': UpdateCardAvailableScene,
};
