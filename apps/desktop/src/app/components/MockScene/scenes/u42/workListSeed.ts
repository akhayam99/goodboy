import {
  brandId,
  type AgentId,
  type AutoTreeId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnState,
} from '@goodboy/types';
import type { AutoPhase } from '@goodboy/db';
import {
  aDelegation,
  aPlanRow,
  aView,
} from '../../../../../features/auto/testing/autoViewFixtures';
import type { WorkLead } from '../../../../../store/slices/work/state';
import { PROJECTS } from '../u24/monitoringSeed';

type LeadParams = {
  readonly key: string;
  readonly phase: AutoPhase;
  readonly title: string;
  readonly sessionGoal: string;
  readonly projectId: string | null;
  readonly branches: ReadonlyArray<string>;
  readonly minutesAgo: number;
  readonly spentUsd: number;
  readonly isPlanReady?: boolean;
  readonly runningRoles?: ReadonlyArray<string>;
};

const MINUTE_MS = 60_000;

const leadOf = ({
  key,
  phase,
  title,
  sessionGoal,
  projectId,
  branches,
  minutesAgo,
  spentUsd,
  isPlanReady = false,
  runningRoles = [],
}: LeadParams): WorkLead => {
  const base = aView({
    phase,
    spentUsd,
    rootAsk: title,
    artifacts: isPlanReady ? [aPlanRow({ approvalState: 'needs_approval' })] : [],
    delegations: runningRoles.map((role) =>
      aDelegation({ key: `${key}-${role}`, role, state: 'running' }),
    ),
  });
  const treeId = brandId<AutoTreeId>({ value: `mock-work-tree-${key}` });
  return {
    treeId,
    sessionId: brandId<SessionId>({ value: `mock-work-session-${key}` }),
    sessionGoal,
    projectId,
    branches,
    view: {
      ...base,
      tree: {
        ...base.tree,
        id: treeId,
        rootAgentId: brandId<AgentId>({ value: `mock-work-agent-${key}` }),
        updatedAt: Date.now() - minutesAgo * MINUTE_MS,
      },
    },
  };
};

const [payments, ledger, notify] = PROJECTS;
const paymentsId = payments?.id ?? null;
const ledgerId = ledger?.id ?? null;
const notifyId = notify?.id ?? null;

export const workListLeads = (): ReadonlyArray<WorkLead> => [
  leadOf({
    key: 'credit',
    phase: 'deciding',
    title: 'Stop retried webhooks posting a second credit',
    sessionGoal: 'Webhook retries and duplicate credits',
    projectId: paymentsId,
    branches: ['harborline/webhook-retries', 'harborline/retry-window'],
    minutesAgo: 5,
    spentUsd: 2.2,
    isPlanReady: true,
  }),
  leadOf({
    key: 'relay',
    phase: 'blocked',
    title: 'Rotate the relay signing key',
    sessionGoal: 'Relay key rotation',
    projectId: notifyId,
    branches: [],
    minutesAgo: 6,
    spentUsd: 0.42,
  }),
  leadOf({
    key: 'export',
    phase: 'answering',
    title: 'Batch the ledger export',
    sessionGoal: 'Webhook retries and duplicate credits',
    projectId: ledgerId,
    branches: ['harborline/ledger-export-batches'],
    minutesAgo: 22,
    spentUsd: 0.58,
    runningRoles: ['implementer', 'tester'],
  }),
  leadOf({
    key: 'paths',
    phase: 'answering',
    title: 'Map retry paths across projects',
    sessionGoal: 'Webhook retries and duplicate credits',
    projectId: null,
    branches: [],
    minutesAgo: 60,
    spentUsd: 0.12,
  }),
  leadOf({
    key: 'rounding',
    phase: 'finished',
    title: 'Fix refund rounding',
    sessionGoal: 'Refund rounding',
    projectId: paymentsId,
    branches: ['harborline/refund-rounding'],
    minutesAgo: 180,
    spentUsd: 1.1,
  }),
  leadOf({
    key: 'audit',
    phase: 'finished',
    title: 'Add the audit trail table',
    sessionGoal: 'Audit trail',
    projectId: ledgerId,
    branches: ['harborline/audit-trail'],
    minutesAgo: 1_500,
    spentUsd: 3.4,
  }),
];

export const workListTurns = (): Readonly<Record<string, TurnState>> => ({
  'mock-work-agent-export': {
    kind: 'running',
    runId: brandId<ProviderRunId>({ value: 'mock-work-run-export' }),
    startedAt: brandId<IsoDateTime>({
      value: new Date(Date.now() - 22 * MINUTE_MS).toISOString(),
    }),
  },
});
