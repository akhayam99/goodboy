import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedSessionCard } from './sidebarListSeed';

export const SessionCardScene = () => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedSessionCard());
  }, []);
  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
