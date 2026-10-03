import { useEffect, useState } from 'react';
import { WorkflowRunDetail } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowRunDetail';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { DYNAMIC_RUN_ID, FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from './fixtures';
import { FINISHED_SESSION } from './finishedRun';
import { PARALLEL_SESSION } from './parallelRun';
import { seedWorkflowRun, seedWorkflowRunFinished, seedWorkflowRunParallel } from './seeds';
import {
  PAUSED_SESSION,
  seedRecentBackfillOutput,
  seedWorkflowRunPaused,
  seedWorkflowRunQuiet,
} from './runControl';

const runVariant = () => new URLSearchParams(window.location.search).get('run');

const sessionFor = () => {
  const variant = runVariant();
  if (variant === 'parallel') {
    return PARALLEL_SESSION;
  }
  if (variant === 'paused') {
    return PAUSED_SESSION;
  }
  return variant === 'finished' ? FINISHED_SESSION : FLOW_SESSION;
};

const seedLiveRun = () => {
  seedWorkflowRun();
  seedRecentBackfillOutput();
};

const seedFor = ({ session }: { readonly session: typeof FLOW_SESSION }) => {
  if (session === PARALLEL_SESSION) {
    return seedWorkflowRunParallel;
  }
  if (session === PAUSED_SESSION) {
    return seedWorkflowRunPaused;
  }
  if (runVariant() === 'quiet') {
    return seedWorkflowRunQuiet;
  }
  return session === FINISHED_SESSION ? seedWorkflowRunFinished : seedLiveRun;
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
