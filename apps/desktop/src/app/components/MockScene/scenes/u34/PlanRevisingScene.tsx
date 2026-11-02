import { useEffect, useState } from 'react';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { FLOW_SESSION_ID, NOW, SESSIONS } from '../flow-audit/fixtures';
import { PLAN_HOLD_DYNAMIC_SESSION, seedWorkflowRunPlanRevising } from '../flow-audit/planHoldRun';

export const PlanRevisingScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowRunPlanRevising();
    seedShellChrome({
      session: PLAN_HOLD_DYNAMIC_SESSION,
      siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION_ID),
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
      session={PLAN_HOLD_DYNAMIC_SESSION}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <SceneRunsSurface session={PLAN_HOLD_DYNAMIC_SESSION} />
        </div>
      }
    />
  );
};
