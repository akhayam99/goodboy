import { useEffect, useState } from 'react';
import { WorkflowRunDetail } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowRunDetail';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { DYNAMIC_RUN_ID, FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from './fixtures';
import { seedWorkflowRun } from './seeds';

export const WorkflowRunScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowRun();
    seedShellChrome({
      session: FLOW_SESSION,
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
      session={FLOW_SESSION}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <WorkflowRunDetail session={FLOW_SESSION} workflowRunId={DYNAMIC_RUN_ID} />
        </div>
      }
    />
  );
};
