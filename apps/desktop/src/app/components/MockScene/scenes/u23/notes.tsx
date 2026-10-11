import { useEffect, useState } from 'react';
import { UnderTrailContext } from '@goodboy/ui';
import { AskTrailButton } from '../../../../../features/session/ask/components/AskTrailButton';
import { TrailBar } from '../../../../../features/session/components/SessionWorkspace/parts/TrailBar';
import { CTX_SESSION, CTX_SESSION_ID } from '../brand/contextBase';
import { DiffStage } from '../brand/DiffStage';
import { seedNotesScene, type NotesVariant } from './notesSeed';

type Props = {
  readonly variant: NotesVariant;
};

const NotesScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedNotesScene({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen w-full bg-background text-foreground">
      <div className="@container flex h-full w-full min-w-0 flex-col">
        <TrailBar session={CTX_SESSION} end={<AskTrailButton sessionId={CTX_SESSION_ID} />} />
        <UnderTrailContext.Provider value>
          <div className="min-h-0 flex-1">
            <DiffStage centerNote={false} />
          </div>
        </UnderTrailContext.Provider>
      </div>
    </main>
  );
};

export const U23_NOTES_SCENES = {
  'branch-files-notes': () => <NotesScene variant="files" />,
  'branch-comments-no-pr': () => <NotesScene variant="comments-no-pr" />,
};
