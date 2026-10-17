import { useEffect, useState } from 'react';
import type { Session, SessionGroupKey, SessionPageView } from '@goodboy/types';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { InactiveSessionsPage } from './r1InactiveSessionsPage';
import { seedInactiveSessions } from './r1InactiveSeed';

type Props = {
  readonly group: SessionGroupKey;
  readonly pageView: SessionPageView | null;
};

export const InactiveSessionsScene = ({ group, pageView }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedInactiveSessions({ group, pageView: pageView ?? 'board' }));
  }, [group, pageView]);
  if (session === null) {
    return null;
  }
  if (pageView === null) {
    return <WorkspaceFrame session={session} />;
  }
  return <WorkspaceFrame session={session} main={<InactiveSessionsPage />} hasRail={false} />;
};
