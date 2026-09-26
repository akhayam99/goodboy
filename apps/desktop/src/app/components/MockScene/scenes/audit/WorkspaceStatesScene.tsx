import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { SESSION, seedWorkflowScene } from '../workflowSeed';
import { WorkspaceFrame } from './WorkspaceFrame';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from './workspaceChrome';
import { sceneParam } from './sceneParams';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-08-25T18:00:00.000Z' });

const ARCHIVED_SESSION: Session = {
  ...SESSION,
  state: { kind: 'ended', endedAt: clock.iso({ at: '2026-08-25T17:59:00.000Z' }) },
  archivedAt: clock.iso({ at: '2026-08-25T17:59:30.000Z' }),
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
