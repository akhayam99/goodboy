import type {
  Agent,
  AgentId,
  ArtifactId,
  ArtifactStatus,
  PlanId,
  PlanWithCount,
  ReportArtifact,
  SessionArtifact,
  SessionId,
  WireframeArtifact,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sceneClock } from '../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const at = (time: string) => clock.iso({ at: `2026-09-14T${time}:00.000Z` });

type SeedParams = {
  readonly sessionId: SessionId;
  readonly plannerId: AgentId;
};

const RETRY_RUNNER = 'mock-states-agent-retry-runner' as AgentId;
const RETRY_PART = 'mock-states-agent-retry-part-1' as AgentId;
const BACKFILL_RUNNER = 'mock-states-agent-backfill-runner' as AgentId;
const BACKFILL_PART_1 = 'mock-states-agent-backfill-part-1' as AgentId;
const BACKFILL_PART_2 = 'mock-states-agent-backfill-part-2' as AgentId;

const PARTS = [
  { title: 'Schema and migration', instructions: 'Add the retry columns to the delivery table.' },
  { title: 'Service changes', instructions: 'Read the retry policy in the sender.' },
  { title: 'Tests and docs', instructions: 'Cover the policy and document the defaults.' },
];

export const statesAgents = ({ sessionId }: SeedParams): ReadonlyArray<Agent> => [
  {
    id: RETRY_RUNNER,
    sessionId,
    ordinal: 10,
    name: 'Implement retry policy for notify-relay',
    kind: 'implementer',
    status: 'completed',
    startedAt: at('15:50'),
    completedAt: at('16:06'),
    lastFinishedAt: at('16:06'),
    doneAt: at('16:06'),
  },
  {
    id: RETRY_PART,
    sessionId,
    parentAgentId: RETRY_RUNNER,
    ordinal: 11,
    name: 'Schema and migration',
    kind: 'implementer',
    status: 'completed',
    startedAt: at('15:51'),
    completedAt: at('16:05'),
    lastFinishedAt: at('16:05'),
    doneAt: at('16:05'),
  },
  {
    id: BACKFILL_RUNNER,
    sessionId,
    ordinal: 12,
    name: 'Implement settlement date backfill',
    kind: 'implementer',
    status: 'running',
    startedAt: at('16:20'),
  },
  {
    id: BACKFILL_PART_1,
    sessionId,
    parentAgentId: BACKFILL_RUNNER,
    ordinal: 13,
    name: 'Schema and migration',
    kind: 'implementer',
    status: 'completed',
    startedAt: at('16:21'),
    completedAt: at('16:30'),
    lastFinishedAt: at('16:30'),
    doneAt: at('16:30'),
  },
  {
    id: BACKFILL_PART_2,
    sessionId,
    parentAgentId: BACKFILL_RUNNER,
    ordinal: 14,
    name: 'Service changes',
    kind: 'implementer',
    status: 'running',
    startedAt: at('16:31'),
  },
];

const plan = ({
  sessionId,
  plannerId,
  id,
  title,
  status,
  createdAt,
  updatedAt,
  clusters,
  runner,
}: SeedParams & {
  readonly id: string;
  readonly title: string;
  readonly status: PlanWithCount['status'];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly clusters: number;
  readonly runner: AgentId | null;
}): PlanWithCount => ({
  id: id as PlanId,
  sessionId,
  agentId: plannerId,
  title,
  bodyMd: `## Goal\n\n${title}.`,
  status,
  clusters: PARTS.slice(0, clusters),
  createdAt: createdAt as PlanWithCount['createdAt'],
  updatedAt: updatedAt as PlanWithCount['updatedAt'],
  consumptionCount: runner === null ? 0 : 1,
  ...(runner === null ? {} : { lastConsumer: { agentId: runner, name: null } }),
});

export const statesPlans = ({ sessionId, plannerId }: SeedParams): ReadonlyArray<PlanWithCount> => {
  const base = { sessionId, plannerId };
  return [
    plan({
      ...base,
      id: 'mock-states-plan-retry',
      title: 'Retry policy for notify-relay webhooks',
      status: 'consumed',
      createdAt: at('15:40'),
      updatedAt: at('16:06'),
      clusters: 3,
      runner: RETRY_RUNNER,
    }),
    plan({
      ...base,
      id: 'mock-states-plan-backfill',
      title: 'Backfill ledger-core settlement dates',
      status: 'consumed',
      createdAt: at('16:10'),
      updatedAt: at('16:31'),
      clusters: 3,
      runner: BACKFILL_RUNNER,
    }),
    plan({
      ...base,
      id: 'mock-states-plan-idempotency',
      title: 'Add idempotency keys to payments-api charges',
      status: 'active',
      createdAt: at('12:40'),
      updatedAt: at('12:40'),
      clusters: 3,
      runner: null,
    }),
    plan({
      ...base,
      id: 'mock-states-plan-postings',
      title: 'Split ledger-core postings table by month',
      status: 'active',
      createdAt: at('11:50'),
      updatedAt: at('11:50'),
      clusters: 2,
      runner: null,
    }),
    plan({
      ...base,
      id: 'mock-states-plan-refund',
      title: 'Draft batch refund endpoint',
      status: 'discarded',
      createdAt: at('09:00'),
      updatedAt: at('14:10'),
      clusters: 2,
      runner: null,
    }),
  ];
};

const deletedReport = ({ sessionId, plannerId }: SeedParams): ReportArtifact => ({
  id: 'mock-states-report-deleted' as ArtifactId,
  sessionId,
  agentId: plannerId,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Ledger index review, first pass',
  sourceFormat: 'markdown',
  sourceText: '# Ledger index review',
  metadata: { reportType: 'session-summary' },
  status: 'discarded',
  revision: 1,
  sourceTurnId: null,
  createdAt: at('08:30'),
  updatedAt: at('13:20'),
  openedAt: at('08:40'),
});

const deletedWireframe = ({ sessionId, plannerId }: SeedParams): WireframeArtifact => ({
  id: 'mock-states-wireframe-deleted' as ArtifactId,
  sessionId,
  agentId: plannerId,
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Notify-relay digest layout',
  sourceFormat: 'json',
  sourceText: '{}',
  metadata: { fidelity: 'low', designProfile: {} },
  status: 'discarded',
  revision: 1,
  sourceTurnId: null,
  createdAt: at('08:00'),
  updatedAt: at('12:10'),
  openedAt: at('08:10'),
});

export const statesArtifacts = (params: SeedParams): ReadonlyArray<SessionArtifact> => [
  deletedReport(params),
  deletedWireframe(params),
];

type StatusParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

const setStatus = ({
  sessionId,
  artifactId,
  status,
}: StatusParams & { readonly status: ArtifactStatus }) =>
  useAppStore.setState((state) => ({
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [sessionId]: (state.sessionArtifacts[sessionId] ?? []).map((artifact) =>
        artifact.id === artifactId ? { ...artifact, status } : artifact,
      ),
    },
    sessionPlans: {
      ...state.sessionPlans,
      [sessionId]: (state.sessionPlans[sessionId] ?? []).map((plan) =>
        plan.id === artifactId ? { ...plan, status } : plan,
      ),
    },
  }));

const statusOf = ({ sessionId, artifactId }: StatusParams): ArtifactStatus | null => {
  const state = useAppStore.getState();
  const plan = (state.sessionPlans[sessionId] ?? []).find((entry) => entry.id === artifactId);
  const stored = (state.sessionArtifacts[sessionId] ?? []).find((entry) => entry.id === artifactId);
  return plan?.status ?? stored?.status ?? null;
};

export const statesStoreActions = () => ({
  deleteArtifact: async ({ sessionId, artifactId }: StatusParams) => {
    const previous = statusOf({ sessionId, artifactId });
    if (previous === null || previous === 'discarded') {
      return null;
    }
    setStatus({ sessionId, artifactId, status: 'discarded' });
    return previous;
  },
  restoreArtifact: async ({
    sessionId,
    artifactId,
    status,
  }: StatusParams & { readonly status?: ArtifactStatus }) =>
    setStatus({ sessionId, artifactId, status: status ?? 'active' }),
  deleteArtifactPermanently: async ({ sessionId, artifactId }: StatusParams) =>
    useAppStore.setState((state) => ({
      sessionArtifacts: {
        ...state.sessionArtifacts,
        [sessionId]: (state.sessionArtifacts[sessionId] ?? []).filter(
          (artifact) => artifact.id !== artifactId,
        ),
      },
      sessionPlans: {
        ...state.sessionPlans,
        [sessionId]: (state.sessionPlans[sessionId] ?? []).filter((plan) => plan.id !== artifactId),
      },
    })),
});
