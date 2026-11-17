import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionEvent,
  SessionEventId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION_ID, seedActivityRunScene } from '../activityRunSeed';

export const BIG_SESSION_ID = SESSION_ID;

export const BIG_SESSION_SIZE = {
  parents: 69,
  children: 102,
  events: 227,
  telemetry: 644,
} as const;

export const BIG_SESSION_AGENT_COUNT = BIG_SESSION_SIZE.parents + BIG_SESSION_SIZE.children;

const BASE_MS = Date.parse('2026-09-10T08:00:00.000Z');
const MINUTE_MS = 60_000;
const TOPICS = [
  'payments-api retry',
  'ledger-core posting',
  'notify-relay fan out',
  'Harborline settlement',
  'Northwind refund',
  'Acme payout limit',
];

type AtParams = {
  readonly minutes: number;
};

const at = ({ minutes }: AtParams): IsoDateTime =>
  new Date(BASE_MS + minutes * MINUTE_MS).toISOString() as IsoDateTime;

type IndexParams = {
  readonly index: number;
};

const parentIdOf = ({ index }: IndexParams): AgentId => `mock-big-agent-${index}` as AgentId;

const runIdOf = ({ index }: IndexParams): ProviderRunId => `mock-big-run-${index}` as ProviderRunId;

const parentOf = ({ index }: IndexParams): Agent => ({
  id: parentIdOf({ index }),
  sessionId: SESSION_ID,
  ordinal: 1_000 + index * 4,
  name: `Map ${TOPICS[index % TOPICS.length]} step ${index + 1}`,
  status: 'completed',
  runId: runIdOf({ index: index * 4 }),
  startedAt: at({ minutes: index * 20 }),
  completedAt: at({ minutes: index * 20 + 6 }),
  lastFinishedAt: at({ minutes: index * 20 + 6 }),
  lastViewedAt: at({ minutes: index * 20 + 7 }),
});

const childOf = ({ index }: IndexParams): Agent => {
  const parent = index % BIG_SESSION_SIZE.parents;
  const slot = Math.floor(index / BIG_SESSION_SIZE.parents) + 1;
  return {
    id: `mock-big-child-${index}` as AgentId,
    sessionId: SESSION_ID,
    parentAgentId: parentIdOf({ index: parent }),
    ordinal: 1_000 + parent * 4 + slot,
    name: `Check ${TOPICS[(parent + slot) % TOPICS.length]} case ${slot}`,
    status: 'completed',
    runId: runIdOf({ index: parent * 4 + slot }),
    startedAt: at({ minutes: parent * 20 + slot }),
    completedAt: at({ minutes: parent * 20 + slot + 2 }),
    lastFinishedAt: at({ minutes: parent * 20 + slot + 2 }),
    lastViewedAt: at({ minutes: parent * 20 + slot + 3 }),
  };
};

export const bigSessionAgents = (): ReadonlyArray<Agent> => [
  ...Array.from({ length: BIG_SESSION_SIZE.parents }, (_, index) => parentOf({ index })),
  ...Array.from({ length: BIG_SESSION_SIZE.children }, (_, index) => childOf({ index })),
];

const eventOf = ({ index }: IndexParams): SessionEvent => ({
  id: `mock-big-event-${index}` as SessionEventId,
  sessionId: SESSION_ID,
  kind: 'branch_switched',
  payload: null,
  createdAt: at({ minutes: index * 6 + 3 }),
});

const telemetryOf = ({ index }: IndexParams): TelemetryRecord => ({
  id: `mock-big-telemetry-${index}` as TelemetryRecordId,
  runId: runIdOf({ index: index % (BIG_SESSION_SIZE.parents * 4) }),
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens: 2_400 + index,
  outputTokens: 380 + index,
  estimatedCostUsd: 0.01,
  recordedAt: at({ minutes: index * 2 }),
});

type RunHistoryParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const runHistoryOf = ({ agents }: RunHistoryParams): Record<string, ReadonlyArray<ProviderRunId>> =>
  Object.fromEntries(
    agents.flatMap((agent) => (agent.runId === undefined ? [] : [[agent.id, [agent.runId]]])),
  );

export const seedBigSession = (): void => {
  seedActivityRunScene();
  const state = useAppStore.getState();
  const agents = bigSessionAgents();
  const events = Array.from({ length: BIG_SESSION_SIZE.events }, (_, index) => eventOf({ index }));
  const telemetry = Array.from({ length: BIG_SESSION_SIZE.telemetry }, (_, index) =>
    telemetryOf({ index }),
  );
  useAppStore.setState({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION_ID]: [...(state.sessionPhaseRuns[SESSION_ID] ?? []), ...agents],
    },
    sessionEvents: {
      ...state.sessionEvents,
      [SESSION_ID]: [...(state.sessionEvents[SESSION_ID] ?? []), ...events],
    },
    sessionTelemetry: {
      ...state.sessionTelemetry,
      [SESSION_ID]: [...(state.sessionTelemetry[SESSION_ID] ?? []), ...telemetry],
    },
    agentRunHistory: { ...state.agentRunHistory, ...runHistoryOf({ agents }) },
  });
};
