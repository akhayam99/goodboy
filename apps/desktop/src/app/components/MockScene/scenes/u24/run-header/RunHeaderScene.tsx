import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { WorkflowsPane } from '../../../../../../features/session/components/SessionWorkspace/parts/WorkflowsPane';
import { installSceneDatabase } from '../../sceneDatabase';
import { installScenePlanEngine } from '../../scenePlanEngine';
import { FLOW_SESSION_ID, NOW, SESSIONS } from '../../flow-audit/fixtures';
import { ShellFrame, seedShellChrome } from '../../shellChrome';

type Props = {
  readonly session: Session;
  readonly seed: () => void;
};

export const RunHeaderScene = ({ session, seed }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seed();
    seedShellChrome({
      session,
      siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    useAppStore.setState({ currentWorkspaceId: session.workspaceId });
    installSceneDatabase();
    installScenePlanEngine({ sessionId: FLOW_SESSION_ID });
    setIsReady(true);
  }, [seed, session]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={session}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <WorkflowsPane session={session} />
        </div>
      }
    />
  );
};
