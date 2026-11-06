import { useEffect, useState, type ComponentProps } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WindowCloseSheet } from '../../../../../features/workspace/components/WindowCloseSheet';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';

type SceneProps = {
  readonly ask: ComponentProps<typeof WindowCloseSheet>['initialAsk'];
};

const WindowCloseScene = ({ ask }: SceneProps) => {
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
      <WindowCloseSheet initialAsk={ask} />
    </>
  );
};

export const U36_P1_WINDOW_CLOSE_SCENES = {
  'u36-p1-window-close': () => <WindowCloseScene ask={{ count: 2, isStuck: false }} />,
  'u36-p1-window-close-run': () => (
    <WindowCloseScene ask={{ count: 1, runCount: 1, isStuck: false }} />
  ),
  'u36-p1-window-close-stuck': () => <WindowCloseScene ask={{ count: 1, isStuck: true }} />,
};
