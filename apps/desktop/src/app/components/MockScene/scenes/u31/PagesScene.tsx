import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { seedPagesPage, type PagesPage } from './pagesSeed';

const FRAME_WIDTH = 680;
const FRAME_HEIGHT = 760;

type Props = {
  readonly page: PagesPage;
};

export const PagesScene = ({ page }: Props) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(seedPagesPage({ page }));
  }, [page]);

  if (session === null) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}>
      <div className="flex h-full min-h-0 flex-col bg-background p-4 text-foreground">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-background ring-1 ring-border-soft">
          {page === 'overview' ? (
            <SessionOverviewPane session={session} />
          ) : (
            <SceneRunsSurface session={session} />
          )}
        </div>
      </div>
    </div>
  );
};
