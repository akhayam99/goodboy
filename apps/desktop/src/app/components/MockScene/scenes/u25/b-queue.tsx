import { useEffect, useState } from 'react';
import type { Session, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from '../flow-audit/fixtures';
import { seedWorkflowRun, seedWorkflowRunFinished } from '../flow-audit/seeds';
import { FINISHED_SESSION } from '../flow-audit/finishedRun';
import { seedRecentBackfillOutput } from '../flow-audit/runControl';

type PatchParams = {
  readonly base: Session;
  readonly patch: (run: WorkflowRun) => WorkflowRun;
};

const patchRun = ({ base, patch }: PatchParams): Session => {
  const [first, ...rest] = base.workflowRuns;
  const session: Session = { ...base, workflowRuns: [patch(first!), ...rest] };
  useAppStore.setState({
    sessions: useAppStore
      .getState()
      .sessions.map((candidate) => (candidate.id === FLOW_SESSION_ID ? session : candidate)),
  });
  return session;
};

type SeedParams = Record<never, never>;

const seedFinished = ({}: SeedParams): Session => {
  seedWorkflowRunFinished();
  return patchRun({
    base: FINISHED_SESSION,
    patch: (run) => ({
      ...run,
      orchestratorHints: [
        { id: 'queue-hint-1', text: 'Rename the Northwind flag too', createdAt: NOW },
        { id: 'queue-hint-2', text: 'Also run the Acme reviewer', createdAt: NOW },
      ],
    }),
  });
};

const seedStopped = ({}: SeedParams): Session => {
  seedWorkflowRun();
  return patchRun({
    base: FLOW_SESSION,
    patch: (run) => ({
      ...run,
      autoRun: false,
      orchestrationStop: {
        kind: 'operator',
        message: 'You stopped this run. The step in flight was skipped.',
      },
    }),
  });
};

const seedPrimary = ({}: SeedParams): Session => {
  seedWorkflowRun();
  seedRecentBackfillOutput();
  return patchRun({ base: FLOW_SESSION, patch: (run) => run });
};

type SceneProps = {
  readonly seed: (params: SeedParams) => Session;
  readonly isComposerOpen?: boolean;
};

const QueueScene = ({ seed, isComposerOpen = false }: SceneProps) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const seeded = seed({});
    seedShellChrome({
      session: seeded,
      siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    useAppStore.setState({ currentWorkspaceId: seeded.workspaceId });
    setSession(seeded);
  }, [seed]);

  useEffect(() => {
    if (session === null || isComposerOpen === false) {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('#orchestrator-hint-field')?.focus();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [isComposerOpen, session]);

  if (session === null) {
    return null;
  }

  return (
    <ShellFrame
      session={session}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <SceneRunsSurface session={session} />
        </div>
      }
    />
  );
};

export const U25_B_QUEUE_SCENES = {
  'queue-read-finished': () => <QueueScene seed={seedFinished} />,
  'queue-composer-primary': () => <QueueScene seed={seedPrimary} isComposerOpen />,
  'queue-stopped-resume': () => <QueueScene seed={seedStopped} />,
};
