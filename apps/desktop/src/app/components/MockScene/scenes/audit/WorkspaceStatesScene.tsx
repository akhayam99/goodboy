import { useEffect, useState } from 'react';
import type { IsoDateTime, Session } from '@goodboy/types';
import { SESSION, seedWorkflowScene } from '../workflowSeed';
import { WorkspaceFrame } from './WorkspaceFrame';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from './workspaceChrome';
import { sceneParam } from './sceneParams';

const ARCHIVED_SESSION: Session = {
  ...SESSION,
  state: { kind: 'ended', endedAt: '2026-08-25T17:59:00.000Z' as IsoDateTime },
  archivedAt: '2026-08-25T17:59:30.000Z' as IsoDateTime,
};

export const WorkspaceStatesScene = () => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    seedWorkflowScene();
    const next = sceneParam({ key: 'archived' }) === '1' ? ARCHIVED_SESSION : SESSION;
    seedWorkspaceChrome({ session: next, siblings: WORKSPACE_SIBLINGS });
    setSession(next);
  }, []);
  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
