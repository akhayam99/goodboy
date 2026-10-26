import { useEffect, useState } from 'react';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { FLOW_SESSION_ID, NOW, SESSIONS } from '../flow-audit/fixtures';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { DEMO_RUN_SESSION } from './demoRunSession';
import { seedDemoRun } from './demoRunSeed';

export const DemoRunScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedDemoRun();
    seedShellChrome({
      session: DEMO_RUN_SESSION,
      siblings: SESSIONS.filter((session) => session.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={DEMO_RUN_SESSION}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <SceneRunsSurface session={DEMO_RUN_SESSION} />
        </div>
      }
    />
  );
};
