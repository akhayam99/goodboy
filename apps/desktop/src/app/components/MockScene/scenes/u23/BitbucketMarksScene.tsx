import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedBitbucketMarks } from './bitbucketMarksSeed';

export const BitbucketMarksScene = () => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedBitbucketMarks());
  }, []);
  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
