import { useEffect, useState } from 'react';
import type { Agent, AgentId, MeasuredTurnSpan } from '@goodboy/types';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { WorkflowsPane } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowsPane';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  AGENT_BACKFILL_ID,
  AGENT_ROUNDING_ID,
  FLOW_AGENTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
  WORKSPACE_ID,
} from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';
import { ShellFrame, seedShellChrome } from '../shellChrome';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const MINUTE_MS = 60_000;

const idOf = ({ kind }: { readonly kind: string }): AgentId => {
  const found = FLOW_AGENTS.find((agent) => agent.kind === kind && agent.parentAgentId == null);
  if (found === undefined) {
    throw new Error(`the flow seed has no ${kind} step`);
  }
  return found.id;
};

const AGENT_SCOUT_ID = idOf({ kind: 'scout' });
const AGENT_PLAN_ID = idOf({ kind: 'planner' });

const LONG_TITLES: Readonly<Record<string, string>> = {
  [AGENT_PLAN_ID]:
    'Agree where the dedupe belongs between the webhook handler, the credit writer and the ledger posting in payments-api',
  [AGENT_BACKFILL_ID]:
    'Record the attempts on each delivery in notify-relay and carry the count into the retry notice',
};

const AGENTS: ReadonlyArray<Agent> = FLOW_AGENTS.map((agent) => {
  const name = LONG_TITLES[agent.id];
  return name === undefined ? agent : { ...agent, name };
});

const spanOf = ({
  agentId,
  provider,
  model,
  effort,
  startedAt,
  endedAt,
  endReason,
}: {
  readonly agentId: AgentId;
  readonly provider: MeasuredTurnSpan['provider'];
  readonly model: string;
  readonly effort: MeasuredTurnSpan['effort'];
  readonly startedAt: string;
  readonly endedAt: string;
  readonly endReason: MeasuredTurnSpan['endReason'];
}): MeasuredTurnSpan => ({
  agentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider,
  model,
  effort,
  startedAtMs: Date.parse(clock.iso({ at: startedAt })),
  endedAtMs: Date.parse(clock.iso({ at: endedAt })),
  endReason,
  costUsd: 0.4,
  touchedMountIds: null,
});

const HANDOFF_SPANS: ReadonlyArray<MeasuredTurnSpan> = [
  spanOf({
    agentId: AGENT_ROUNDING_ID,
    provider: 'cursor',
    model: 'composer-2.5',
    effort: 'medium',
    startedAt: '2026-09-16T09:44:00.000Z',
    endedAt: '2026-09-16T09:52:00.000Z',
    endReason: 'failed',
  }),
  spanOf({
    agentId: AGENT_ROUNDING_ID,
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    effort: 'high',
    startedAt: '2026-09-16T09:53:00.000Z',
    endedAt: '2026-09-16T10:31:00.000Z',
    endReason: 'succeeded',
  }),
];

const HISTORY_STEPS = [6, 7, 8, 9, 10].map((minutes) => ({
  role: 'implementer' as const,
  provider: 'cursor' as const,
  model: 'kimi-k3',
  effort: 'high' as const,
  activeMs: minutes * MINUTE_MS,
  costUsd: 0.3,
  endedAtMs: Date.parse(NOW) - MINUTE_MS,
}));

const seedStepRows = (): void => {
  seedWorkflowRun();
  useAppStore.setState({
    sessionPhaseRuns: { [FLOW_SESSION_ID]: AGENTS },
    sessionTurnSpans: { [FLOW_SESSION_ID]: HANDOFF_SPANS },
    agentEffortOverride: {
      [AGENT_SCOUT_ID]: 'low',
      [AGENT_PLAN_ID]: 'high',
      [AGENT_ROUNDING_ID]: 'high',
      [AGENT_BACKFILL_ID]: 'high',
    },
    workspaceDurationHistory: {
      [WORKSPACE_ID]: {
        steps: HISTORY_STEPS,
        turns: [],
        everyWorkspace: { steps: [], turns: [] },
        orchestratedRuns: [],
      },
    },
  });
};

type Surface = 'activity' | 'runs';

type SceneProps = {
  readonly surface: Surface;
};

const StepRowsScene = ({ surface }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStepRows();
    seedShellChrome({
      session: FLOW_SESSION,
      siblings: SESSIONS.filter((session) => session.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: surface === 'runs' ? 'workflows' : null,
    });
    setIsReady(true);
  }, [surface]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={FLOW_SESSION}
      main={
        <div className="flex h-full min-h-0 flex-col">
          {surface === 'runs' ? (
            <WorkflowsPane session={FLOW_SESSION} />
          ) : (
            <SessionOverviewPane session={FLOW_SESSION} onSelectLens={() => undefined} />
          )}
        </div>
      }
    />
  );
};

export const U23_STEP_ROWS_SCENES = {
  'step-rows-activity': () => <StepRowsScene surface="activity" />,
  'step-rows-runs': () => <StepRowsScene surface="runs" />,
};
