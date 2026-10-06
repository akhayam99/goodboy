import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedSessionColumn } from './sessionColumnSeed';
import { useSceneScript } from './useSceneScript';

type Props = {
  readonly isArchivedShown: boolean;
  readonly run: () => boolean;
};

export const SessionColumnScene = ({ isArchivedShown, run }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedSessionColumn({ isArchivedShown }));
  }, [isArchivedShown]);
  useSceneScript({ isReady: session !== null, run });
  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
