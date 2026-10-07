import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedPinnedSessions } from './sidebarListSeed';

export const SessionPinnedScene = () => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedPinnedSessions());
  }, []);
  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
