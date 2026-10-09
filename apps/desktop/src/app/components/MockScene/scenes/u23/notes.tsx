import { useEffect, useState } from 'react';
import { DrawerColumn, UnderTrailContext } from '@goodboy/ui';
import { AskTrailButton } from '../../../../../features/session/ask/components/AskTrailButton';
import { TrailBar } from '../../../../../features/session/components/SessionWorkspace/parts/TrailBar';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { CTX_SESSION, CTX_SESSION_ID } from '../brand/contextBase';
import { DiffStage } from '../brand/DiffStage';
import { seedNotesScene, type NotesVariant } from './notesSeed';

type Props = {
  readonly variant: NotesVariant;
};

export const NotesScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const sizing = useAppStore(selectDrawerSizing);

  useEffect(() => {
    seedNotesScene({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen w-full bg-background text-foreground">
      <DrawerColumn
        main={
          <div className="@container flex h-full w-full min-w-0 flex-col">
            <TrailBar session={CTX_SESSION} end={<AskTrailButton sessionId={CTX_SESSION_ID} />} />
            <UnderTrailContext.Provider value>
              <div className="min-h-0 flex-1">
                <DiffStage centerNote={false} />
              </div>
            </UnderTrailContext.Provider>
          </div>
        }
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        sizing={sizing}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};

export const U23_NOTES_SCENES = {
  'branch-files-notes': () => <NotesScene variant="files" />,
  'branch-notes-fixing': () => <NotesScene variant="fixing" />,
  'branch-notes-ready': () => <NotesScene variant="ready" />,
  'branch-notes-empty': () => <NotesScene variant="empty" />,
  'branch-comments-no-pr': () => <NotesScene variant="comments-no-pr" />,
};
