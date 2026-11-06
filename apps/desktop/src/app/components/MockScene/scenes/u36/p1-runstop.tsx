import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SceneRunsSurface } from '../SceneRunsSurface';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import {
  AGENT_BACKFILL_ID,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';

const OPERATOR_STOP = {
  kind: 'operator',
  message: 'You stopped this run. What the step wrote is kept, and Continue picks it up.',
} as const;

type SeedParams = {
  readonly isCut: boolean;
};

const seedRunStop = ({ isCut }: SeedParams): Session => {
  seedWorkflowRun();
  const [first, ...rest] = FLOW_SESSION.workflowRuns;
  const session: Session =
    first === undefined
      ? FLOW_SESSION
      : {
          ...FLOW_SESSION,
          workflowRuns: [{ ...first, autoRun: false, orchestrationStop: OPERATOR_STOP }, ...rest],
        };
  const state = useAppStore.getState();
  useAppStore.setState({
    sessions: state.sessions.map((candidate) =>
      candidate.id === FLOW_SESSION_ID ? session : candidate,
    ),
    ...(isCut && {
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [FLOW_SESSION_ID]: (state.sessionPhaseRuns[FLOW_SESSION_ID] ?? []).map((agent) =>
          agent.id === AGENT_BACKFILL_ID
            ? { ...agent, status: 'stopped' as const, stoppedBy: 'you' as const, stoppedAt: NOW }
            : agent,
        ),
      },
      agentTurnState: { [AGENT_BACKFILL_ID]: { kind: 'idle', lastActivityAt: NOW } },
    }),
  });
  return session;
};

type SceneProps = {
  readonly isCut: boolean;
};

const RunStopScene = ({ isCut }: SceneProps) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const seeded = seedRunStop({ isCut });
    seedShellChrome({
      session: seeded,
      siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    useAppStore.setState({ currentWorkspaceId: seeded.workspaceId });
    setSession(seeded);
  }, [isCut]);

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

export const U36_P1_RUNSTOP_SCENES = {
  'u36-p1-run-stopping': () => <RunStopScene isCut={false} />,
  'u36-p1-run-stopped': () => <RunStopScene isCut />,
};
