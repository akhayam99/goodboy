import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { WorkflowRunDetail } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowRunDetail';
import type { AgentKind } from '../../../../../features/session/agent-kind';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  AGENT_BACKFILL_ID,
  AGENT_ROUNDING_ID,
  CHAT_AGENTS,
  CHAT_SESSION_ID,
  DYNAMIC_RUN_ID,
  FLOW_AGENTS,
  FLOW_AGENT_KINDS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  FLOW_TELEMETRY,
  NOW,
  SESSIONS,
} from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';
import { ShellFrame, seedShellChrome } from '../shellChrome';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const at = ({ time }: { readonly time: string }): IsoDateTime =>
  clock.iso({ at: `2026-09-16T${time}:00.000Z` });

type ChildParams = {
  readonly key: string;
  readonly step: AgentId;
  readonly parent: AgentId;
  readonly ordinal: number;
  readonly name: string;
  readonly summary: string;
  readonly kind: AgentKind;
  readonly startedAt: IsoDateTime;
  readonly completedAt?: IsoDateTime;
};

const parentOf = ({ id }: { readonly id: AgentId }): Agent => {
  const found = FLOW_AGENTS.find((agent) => agent.id === id);
  if (found === undefined) {
    throw new Error(`the flow seed has no agent ${id}`);
  }
  return found;
};

const childOf = ({
  key,
  step,
  parent,
  ordinal,
  name,
  summary,
  kind,
  startedAt,
  completedAt,
}: ChildParams): Agent => ({
  ...parentOf({ id: step }),
  id: `mock-run-tree-${key}` as AgentId,
  parentAgentId: parent,
  ordinal,
  name,
  kind,
  runId: `mock-run-tree-provider-${key}` as ProviderRunId,
  outputSummary: summary,
  startedAt,
  status: completedAt === undefined ? 'running' : 'completed',
  completedAt,
  lastFinishedAt: completedAt,
  lastViewedAt: completedAt === undefined ? undefined : NOW,
  doneAt: completedAt,
});

const runningOf = ({ id }: { readonly id: AgentId }): Agent => ({
  ...parentOf({ id }),
  status: 'running',
  completedAt: undefined,
  lastFinishedAt: undefined,
  doneAt: undefined,
});

const ROUNDING_SCOUTS: ReadonlyArray<Agent> = [
  childOf({
    key: 'rounding-scout-writer',
    step: AGENT_ROUNDING_ID,
    parent: AGENT_ROUNDING_ID,
    ordinal: 2.1,
    name: 'Read the credit writer in payments-api',
    summary: 'The writer opens its transaction after the event check.',
    kind: 'scout',
    startedAt: at({ time: '09:45' }),
    completedAt: at({ time: '09:51' }),
  }),
  childOf({
    key: 'rounding-scout-tests',
    step: AGENT_ROUNDING_ID,
    parent: AGENT_ROUNDING_ID,
    ordinal: 2.2,
    name: 'Find the webhook tests that cover a retry',
    summary: 'Two tests cover a retry, neither covers a retry mid-write.',
    kind: 'scout',
    startedAt: at({ time: '09:46' }),
    completedAt: at({ time: '09:53' }),
  }),
  childOf({
    key: 'rounding-scout-schema',
    step: AGENT_ROUNDING_ID,
    parent: AGENT_ROUNDING_ID,
    ordinal: 2.3,
    name: 'Check the unique key on the credits table',
    summary: 'The credits table has no unique key on the event id.',
    kind: 'scout',
    startedAt: at({ time: '09:47' }),
    completedAt: at({ time: '09:55' }),
  }),
];

const BACKFILL_SET: ReadonlyArray<Agent> = [
  childOf({
    key: 'backfill-scout-log',
    step: AGENT_BACKFILL_ID,
    parent: AGENT_BACKFILL_ID,
    ordinal: 3.1,
    name: 'Read the delivery log schema',
    summary: 'Each delivery row already has a retry counter column.',
    kind: 'scout',
    startedAt: at({ time: '10:35' }),
    completedAt: at({ time: '10:41' }),
  }),
  childOf({
    key: 'backfill-scout-backoff',
    step: AGENT_BACKFILL_ID,
    parent: AGENT_BACKFILL_ID,
    ordinal: 3.2,
    name: 'Check the retry backoff in notify-relay',
    summary: '',
    kind: 'scout',
    startedAt: at({ time: '10:42' }),
  }),
];

const spendOf = ({
  agent,
  costUsd,
}: {
  readonly agent: Agent;
  readonly costUsd: number;
}): TelemetryRecord => ({
  id: `mock-run-tree-telemetry-${agent.id}` as TelemetryRecordId,
  runId: agent.runId as ProviderRunId,
  sessionId: FLOW_SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-haiku-4-5',
  recordedAt: agent.completedAt ?? NOW,
  inputTokens: 14_200,
  outputTokens: 1_900,
  estimatedCostUsd: costUsd,
});

const SCOUT_SPEND: ReadonlyArray<TelemetryRecord> = ROUNDING_SCOUTS.map((agent) =>
  spendOf({ agent, costUsd: 0.03 }),
);

const kindsOf = ({ agents }: { readonly agents: ReadonlyArray<Agent> }) =>
  Object.fromEntries(agents.map((agent) => [agent.id, agent.kind as AgentKind]));

const seedWith = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): void => {
  seedWorkflowRun();
  useAppStore.setState({
    sessionPhaseRuns: { [FLOW_SESSION_ID]: agents, [CHAT_SESSION_ID]: CHAT_AGENTS },
    sessionTelemetry: { [FLOW_SESSION_ID]: [...FLOW_TELEMETRY, ...SCOUT_SPEND] },
    agentKindOverride: { ...FLOW_AGENT_KINDS, ...kindsOf({ agents }) },
  });
};

const seedFinishedSets = (): void => {
  const agents = [
    ...FLOW_AGENTS.map((agent) =>
      agent.id === AGENT_ROUNDING_ID ? runningOf({ id: AGENT_ROUNDING_ID }) : agent,
    ),
    ...ROUNDING_SCOUTS,
    ...BACKFILL_SET,
  ];
  seedWith({ agents });
};

const NESTED_LEAD = childOf({
  key: 'backfill-lead',
  step: AGENT_BACKFILL_ID,
  parent: AGENT_BACKFILL_ID,
  ordinal: 3.1,
  name: 'Map the retry path in notify-relay',
  summary: 'Three modules touch a retry, two of them already count attempts.',
  kind: 'scout',
  startedAt: at({ time: '10:35' }),
  completedAt: at({ time: '10:48' }),
});

const NESTED_SECOND = childOf({
  key: 'backfill-second',
  step: AGENT_BACKFILL_ID,
  parent: AGENT_BACKFILL_ID,
  ordinal: 3.2,
  name: 'Check the retry backoff in notify-relay',
  summary: '',
  kind: 'scout',
  startedAt: at({ time: '10:49' }),
});

const NESTED_GRANDCHILDREN: ReadonlyArray<Agent> = [
  childOf({
    key: 'grand-queue',
    step: AGENT_BACKFILL_ID,
    parent: NESTED_LEAD.id,
    ordinal: 3.11,
    name: 'Read the delivery queue worker',
    summary: 'The worker re-enqueues a failed delivery with no attempt count.',
    kind: 'scout',
    startedAt: at({ time: '10:36' }),
    completedAt: at({ time: '10:42' }),
  }),
  childOf({
    key: 'grand-sender',
    step: AGENT_BACKFILL_ID,
    parent: NESTED_LEAD.id,
    ordinal: 3.12,
    name: 'Read the sender client',
    summary: '',
    kind: 'scout',
    startedAt: at({ time: '10:43' }),
  }),
];

const seedNested = (): void => {
  seedWith({
    agents: [...FLOW_AGENTS, NESTED_LEAD, NESTED_SECOND, ...NESTED_GRANDCHILDREN],
  });
};

type SceneProps = {
  readonly seed: () => void;
};

const RunTreeScene = ({ seed }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seed();
    seedShellChrome({
      session: FLOW_SESSION,
      siblings: SESSIONS.filter((session) => session.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    setIsReady(true);
  }, [seed]);

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

export const U21_RUN_TREE_SCENES = {
  'workflow-run-finished-sets': () => <RunTreeScene seed={seedFinishedSets} />,
  'workflow-run-nested': () => <RunTreeScene seed={seedNested} />,
};
