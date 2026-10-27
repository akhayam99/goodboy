import { useEffect, useState } from 'react';
import { brandId, type Agent, type AgentId, type ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { FLOW_AGENTS, FLOW_SESSION, FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';
import { SceneRunsSurface } from '../SceneRunsSurface';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const BASE = FLOW_AGENTS[0];

type HandParams = {
  readonly key: string;
  readonly name: string;
  readonly status: Agent['status'];
  readonly startedAt: string;
  readonly stoppedBy?: Agent['stoppedBy'];
  readonly lastFinishedAt?: string;
};

const handAgentOf = ({
  key,
  name,
  status,
  startedAt,
  stoppedBy,
  lastFinishedAt,
}: HandParams): Agent => {
  if (BASE === undefined) {
    throw new Error('the flow seed has no agents');
  }
  return {
    ...BASE,
    id: brandId<AgentId>({ value: `mock-state-agent-${key}` }),
    sessionId: FLOW_SESSION_ID,
    stepId: undefined,
    workflowRunId: undefined,
    parentAgentId: undefined,
    ordinal: 0,
    name,
    kind: 'scout',
    status,
    startedAt: clock.iso({ at: startedAt }),
    completedAt: undefined,
    doneAt: undefined,
    stoppedBy,
    lastFinishedAt: lastFinishedAt === undefined ? undefined : clock.iso({ at: lastFinishedAt }),
    lastViewedAt: undefined,
  };
};

const STATE_AGENTS: ReadonlyArray<Agent> = [
  handAgentOf({
    key: 'runner',
    name: 'Trace the retried webhook in payments-api',
    status: 'running',
    startedAt: '2026-09-16T11:05:00.000Z',
  }),
  handAgentOf({
    key: 'pnpm',
    name: 'Run the settlement suite in ledger-core',
    status: 'running',
    startedAt: '2026-09-16T10:40:00.000Z',
  }),
  handAgentOf({
    key: 'reviewer',
    name: 'Review the notify-relay backoff change',
    status: 'completed',
    startedAt: '2026-09-16T09:40:00.000Z',
    lastFinishedAt: '2026-09-16T10:10:00.000Z',
  }),
  handAgentOf({
    key: 'first-stopped',
    name: 'Backfill the Northwind deliveries',
    status: 'stopped',
    startedAt: '2026-09-16T10:20:00.000Z',
    stoppedBy: 'app',
  }),
  handAgentOf({
    key: 'second-stopped',
    name: 'Check the Acme export totals',
    status: 'stopped',
    startedAt: '2026-09-16T10:10:00.000Z',
    stoppedBy: 'app',
  }),
  handAgentOf({
    key: 'blocked',
    name: 'Tidy the Cascadia fixtures',
    status: 'blocked',
    startedAt: '2026-09-16T09:50:00.000Z',
  }),
];

const BLOCKED_ID = brandId<AgentId>({ value: 'mock-state-agent-pnpm' });

export const AgentStateRunsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowRun();
    useAppStore.setState({
      sessionPhaseRuns: { [FLOW_SESSION_ID]: STATE_AGENTS },
      sessionWorkflows: { [FLOW_SESSION_ID]: [] },
      agentKindOverride: {},
      focusedWorkflowRunId: {},
      sessionOpenQuestions: { [FLOW_SESSION_ID]: [] },
      agentTurnState: {
        [BLOCKED_ID]: {
          kind: 'blocked',
          runId: brandId<ProviderRunId>({ value: 'mock-state-provider-run-pnpm' }),
          blockedAt: clock.iso({ at: '2026-09-16T11:10:00.000Z' }),
        },
      },
    });
    useAppStore.setState({ currentSessionId: FLOW_SESSION_ID });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <SceneRunsSurface session={FLOW_SESSION} />
    </div>
  );
};
