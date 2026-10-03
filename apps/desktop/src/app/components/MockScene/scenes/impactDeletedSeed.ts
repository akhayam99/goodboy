import type { DormantTelemetry } from '@goodboy/db';
import type {
  IsoDateTime,
  ProviderName,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';

export const IMPACT_DELETED_WORKSPACE_ID = 'mock-impact-deleted-harborline' as WorkspaceId;

const NOW = Date.now();
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const TOTAL_SESSIONS = 90;
const DELETED_SESSIONS = 77;
const ORCHESTRATED_SESSIONS = 54;
const TURNS_PER_SESSION = 6;

type SeedSession = {
  readonly id: SessionId;
  readonly goal: string;
  readonly isDeleted: boolean;
  readonly spendUsd: number;
  readonly hours: number;
  readonly merged: number;
  readonly provider: ProviderName;
  readonly model: string;
};

type SeedParams = {
  readonly name: string;
  readonly goal: string;
  readonly facts: Omit<SeedSession, 'id' | 'goal'>;
};

const seed = ({ name, goal, facts }: SeedParams): SeedSession => ({
  id: `mock-impact-deleted-${name}` as SessionId,
  goal,
  ...facts,
});

const SESSIONS: ReadonlyArray<SeedSession> = [
  seed({
    name: 'settlement',
    goal: 'Reconcile the settlement export against the ledger snapshot',
    facts: {
      isDeleted: true,
      spendUsd: 612.4,
      hours: 41.5,
      merged: 5,
      provider: 'anthropic',
      model: 'claude-opus-5',
    },
  }),
  seed({
    name: 'credit',
    goal: 'Stop retried webhooks posting a second credit',
    facts: {
      isDeleted: true,
      spendUsd: 498.15,
      hours: 33.2,
      merged: 4,
      provider: 'anthropic',
      model: 'claude-sonnet-5',
    },
  }),
  seed({
    name: 'cron',
    goal: 'Retire the legacy export cron job',
    facts: {
      isDeleted: true,
      spendUsd: 301.22,
      hours: 12.4,
      merged: 3,
      provider: 'codex',
      model: 'gpt-5.6-sol',
    },
  }),
  seed({
    name: 'refunds',
    goal: 'Split payments-api refunds',
    facts: {
      isDeleted: true,
      spendUsd: 254.9,
      hours: 18.9,
      merged: 3,
      provider: 'anthropic',
      model: 'claude-sonnet-5',
    },
  }),
  seed({
    name: 'limits',
    goal: 'Per-tenant limits on the public API',
    facts: {
      isDeleted: true,
      spendUsd: 188.34,
      hours: 9.6,
      merged: 2,
      provider: 'cursor',
      model: 'composer-2.5-fast',
    },
  }),
  seed({
    name: 'queue',
    goal: 'Move notify-relay to the new queue',
    facts: {
      isDeleted: true,
      spendUsd: 99.48,
      hours: 6.1,
      merged: 1,
      provider: 'codex',
      model: 'gpt-6-astra',
    },
  }),
  seed({
    name: 'payout',
    goal: 'Warn merchants before a payout hold',
    facts: {
      isDeleted: false,
      spendUsd: 142.67,
      hours: 22.8,
      merged: 1,
      provider: 'anthropic',
      model: 'claude-opus-5',
    },
  }),
  seed({
    name: 'bundle',
    goal: 'Trim the storefront-web bundle',
    facts: {
      isDeleted: false,
      spendUsd: 57.45,
      hours: 4.3,
      merged: 1,
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    },
  }),
];

const iso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

type RecordsParams = {
  readonly session: SeedSession;
  readonly index: number;
};

const recordsOf = ({ session, index }: RecordsParams): ReadonlyArray<TelemetryRecord> =>
  Array.from({ length: TURNS_PER_SESSION }, (_, turn) => ({
    id: `mock-impact-deleted-telemetry-${index}-${turn}` as TelemetryRecordId,
    runId: `mock-impact-deleted-run-${index}-${turn}` as ProviderRunId,
    sessionId: session.id,
    kind: 'turn' as const,
    provider: session.provider,
    model: session.model,
    inputTokens: 48_000 + turn * 3_000,
    outputTokens: 3_200 + turn * 200,
    estimatedCostUsd: Number((session.spendUsd / TURNS_PER_SESSION).toFixed(6)),
    recordedAt: iso(turn === 0 ? NOW - (index + 1) * HOUR_MS : NOW - (index * 5 + turn) * DAY_MS),
  }));

export const impactDeletedLiveSessions = (): ReadonlyArray<Session> =>
  SESSIONS.filter((session) => !session.isDeleted).map((session): Session => ({
    id: session.id,
    workspaceId: IMPACT_DELETED_WORKSPACE_ID,
    goal: session.goal,
    state: { kind: 'idle', lastActivityAt: iso(NOW - HOUR_MS) },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    permissionMode: 'default',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: true,
    createdAt: iso(NOW - 20 * DAY_MS),
    updatedAt: iso(NOW - HOUR_MS),
  }));

export const impactDeletedLiveTelemetry = (): Readonly<
  Record<string, ReadonlyArray<TelemetryRecord>>
> =>
  Object.fromEntries(
    SESSIONS.flatMap((session, index) =>
      session.isDeleted ? [] : [[session.id, recordsOf({ session, index })]],
    ),
  );

export const impactDeletedDormantSpend = (): ReadonlyArray<DormantTelemetry> =>
  SESSIONS.flatMap((session, index) =>
    session.isDeleted
      ? recordsOf({ session, index }).map((record) => ({
          record,
          goal: session.goal,
          isDeleted: true,
        }))
      : [],
  );

type FlagParams = {
  readonly session: SeedSession;
};

const isDeletedFlag = ({ session }: FlagParams): number => (session.isDeleted ? 1 : 0);

const OVERVIEW_ROW = {
  session_count: TOTAL_SESSIONS,
  orchestrated_sessions: ORCHESTRATED_SESSIONS,
  deleted_sessions: DELETED_SESSIONS,
};

const durationRows = () =>
  [...SESSIONS]
    .sort((left, right) => right.hours - left.hours)
    .map((session) => ({
      session_id: session.id,
      goal: session.goal,
      is_deleted: isDeletedFlag({ session }),
      duration_hours: session.hours,
    }));

const spendRows = () =>
  [...SESSIONS]
    .sort((left, right) => right.spendUsd - left.spendUsd)
    .map((session) => ({
      session_id: session.id,
      goal: session.goal,
      is_deleted: isDeletedFlag({ session }),
      spend_usd: session.spendUsd,
    }));

const PR_TITLES = [
  'Credit once per event id',
  'Reconcile the settlement export',
  'Hold payouts behind a merchant notice',
  'Split refunds by ledger account',
  'Rate limit the public API per tenant',
];

const pullRequestRows = () =>
  SESSIONS.flatMap((session, index) =>
    Array.from({ length: session.merged }, (_, offset) => {
      const number = 300 + index * 10 + offset;
      return {
        source: session.isDeleted ? 'event' : 'link',
        session_id: session.id,
        goal: session.goal,
        is_deleted: isDeletedFlag({ session }),
        host: 'github.com',
        repository: 'harborline/ledger-core',
        number,
        title: PR_TITLES[(index + offset) % PR_TITLES.length] ?? 'Ship the change',
        url: `https://github.com/harborline/ledger-core/pull/${number}`,
        state: 'merged',
        happened_at: NOW - (index * 6 + offset + 1) * DAY_MS,
        session_spend: session.spendUsd,
      };
    }),
  );

const reviewRows = () =>
  SESSIONS.flatMap((session, index) =>
    Array.from({ length: 7 }, (_, offset) => ({
      session_id: session.id,
      goal: session.goal,
      is_deleted: isDeletedFlag({ session }),
      file_path: `src/ledger/${['export', 'refunds', 'payouts'][offset % 3]}.ts`,
      status: offset === 6 && index % 2 === 0 ? 'consumed' : 'resolved',
      duration_hours: 0.2 + offset * 0.4,
    })),
  );

type SelectParams = {
  readonly sql: string;
};

export const impactDeletedSelect = ({ sql }: SelectParams): ReadonlyArray<unknown> => {
  if (sql.includes('orchestrated_sessions')) {
    return [OVERVIEW_ROW];
  }
  if (sql.includes('FROM mount_pr_links link') && sql.includes('UNION ALL')) {
    return pullRequestRows();
  }
  if (sql.includes('FROM diff_comments d')) {
    return reviewRows();
  }
  if (sql.includes('AS spend_usd') && sql.includes('GROUP BY s.id')) {
    return spendRows();
  }
  if (sql.includes('AS duration_hours') && sql.includes('FROM sessions s')) {
    return durationRows();
  }
  return [];
};
