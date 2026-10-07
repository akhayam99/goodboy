import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedSessionMarks } from './sessionMarksSeed';

export const SessionMarksScene = () => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedSessionMarks());
  }, []);
  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
