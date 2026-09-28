import { useEffect, useState } from 'react';
import { WorkflowRunDetail } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowRunDetail';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { DYNAMIC_RUN_ID, FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from './fixtures';
import { PARALLEL_SESSION } from './parallelRun';
import { seedWorkflowRun, seedWorkflowRunParallel } from './seeds';

const isParallelRun = () => new URLSearchParams(window.location.search).get('run') === 'parallel';

export const WorkflowRunScene = () => {
  const [isReady, setIsReady] = useState(false);
  const [session] = useState(() => (isParallelRun() ? PARALLEL_SESSION : FLOW_SESSION));

  useEffect(() => {
    if (session === PARALLEL_SESSION) {
      seedWorkflowRunParallel();
    } else {
      seedWorkflowRun();
    }
    seedShellChrome({
      session,
      siblings: SESSIONS.filter((session) => session.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    setIsReady(true);
  }, [session]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={session}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <WorkflowRunDetail session={session} workflowRunId={DYNAMIC_RUN_ID} />
        </div>
      }
    />
  );
};
