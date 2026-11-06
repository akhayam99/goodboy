import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WindowCloseSheet } from '../../../../../features/workspace/components/WindowCloseSheet';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';

type SceneProps = {
  readonly isStuck: boolean;
};

const WindowCloseScene = ({ isStuck }: SceneProps) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    seedWorkflowRun();
    seedShellChrome({
      session: FLOW_SESSION,
      siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    useAppStore.setState({ currentWorkspaceId: FLOW_SESSION.workspaceId });
    setSession(FLOW_SESSION);
  }, []);

  if (session === null) {
    return null;
  }

  return (
    <>
      <ShellFrame
        session={session}
        main={
          <div className="flex h-full min-h-0 flex-col">
            <SceneRunsSurface session={session} />
          </div>
        }
      />
      <WindowCloseSheet initialAsk={{ count: isStuck ? 1 : 2, isStuck }} />
    </>
  );
};

export const U36_P1_WINDOW_CLOSE_SCENES = {
  'u36-p1-window-close': () => <WindowCloseScene isStuck={false} />,
  'u36-p1-window-close-stuck': () => <WindowCloseScene isStuck />,
};
