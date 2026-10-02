import { useEffect, useState } from 'react';
import { WorkflowRunDetail } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowRunDetail';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { DYNAMIC_RUN_ID, FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from './fixtures';
import { FINISHED_SESSION } from './finishedRun';
import { PARALLEL_SESSION } from './parallelRun';
import { seedWorkflowRun, seedWorkflowRunFinished, seedWorkflowRunParallel } from './seeds';

const runVariant = () => new URLSearchParams(window.location.search).get('run');

const sessionFor = () => {
  const variant = runVariant();
  if (variant === 'parallel') {
    return PARALLEL_SESSION;
  }
  return variant === 'finished' ? FINISHED_SESSION : FLOW_SESSION;
};

const seedFor = ({ session }: { readonly session: typeof FLOW_SESSION }) => {
  if (session === PARALLEL_SESSION) {
    return seedWorkflowRunParallel;
  }
  return session === FINISHED_SESSION ? seedWorkflowRunFinished : seedWorkflowRun;
};

export const WorkflowRunScene = () => {
  const [isReady, setIsReady] = useState(false);
  const [session] = useState(sessionFor);

  useEffect(() => {
    seedFor({ session })();
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
