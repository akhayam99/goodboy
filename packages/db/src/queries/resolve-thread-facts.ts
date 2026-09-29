import type {
  ResolveSourceChange,
  ResolveSourceKind,
  ResolveSourceSnapshot,
  ResolveThreadFacts,
  ResolveThreadGitState,
  ResolveVerdict,
  ResolveVerdictKind,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, isStringArray, parseJsonColumn } from '../shared/parseJsonColumn';

type Row = {
  readonly threadId: string;
  readonly gitState: string | null;
  readonly verdict: string | null;
  readonly sourceSnapshot: string | null;
  readonly sourceKind: string;
  readonly providerThreadId: string | null;
};

type ThreadParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly threadId: string;
};

const GIT_STATES: ReadonlyArray<ResolveThreadGitState> = [
  'local',
  'on_origin',
  'fixed_elsewhere',
  'folded',
  'missing',
];
const SOURCE_KINDS: ReadonlyArray<ResolveSourceKind> = ['github', 'gitlab', 'bitbucket', 'local'];
const VERDICT_KINDS: ReadonlyArray<ResolveVerdictKind> = ['fixed_elsewhere', 'obsolete', 'refix'];

const isVerdict = (value: unknown): value is ResolveVerdict =>
  isJsonRecord(value) &&
  VERDICT_KINDS.some((kind) => kind === value.kind) &&
  typeof value.evidence === 'string' &&
  (value.sha === null || typeof value.sha === 'string') &&
  typeof value.checkedAt === 'number';

const isChange = (value: unknown): value is ResolveSourceChange =>
  isJsonRecord(value) &&
  typeof value.body === 'string' &&
  (value.author === null || typeof value.author === 'string') &&
  typeof value.fingerprint === 'string' &&
  typeof value.seenAt === 'number';

const isSnapshot = (value: unknown): value is ResolveSourceSnapshot =>
  isJsonRecord(value) &&
  typeof value.body === 'string' &&
  (value.author === null || typeof value.author === 'string') &&
  typeof value.fingerprint === 'string' &&
  typeof value.seenAt === 'number' &&
  isStringArray(value.replyIds) &&
  (value.changed === null || isChange(value.changed));

const hydrate = ({ row }: { readonly row: Row }): ResolveThreadFacts => ({
  threadId: row.threadId,
  gitState: GIT_STATES.find((state) => state === row.gitState) ?? null,
  verdict: parseJsonColumn<ResolveVerdict | null>({
    value: row.verdict,
    isValid: isVerdict,
    fallback: null,
  }),
  sourceSnapshot: parseJsonColumn<ResolveSourceSnapshot | null>({
    value: row.sourceSnapshot,
    isValid: isSnapshot,
    fallback: null,
  }),
  sourceKind: SOURCE_KINDS.find((kind) => kind === row.sourceKind) ?? 'github',
  providerThreadId: row.providerThreadId,
});

export const listResolveThreadFacts = async ({
  db,
  sessionId,
}: {
  readonly db: Database;
  readonly sessionId: SessionId;
}): Promise<ReadonlyArray<ResolveThreadFacts>> => {
  const rows = await db.select<Row>(
    `SELECT thread_id AS threadId, git_state AS gitState, verdict_json AS verdict,
      source_snapshot_json AS sourceSnapshot, source_kind AS sourceKind,
      provider_thread_id AS providerThreadId
     FROM resolve_threads WHERE session_id = ? ORDER BY created_at, id`,
    [sessionId],
  );
  return rows.map((row) => hydrate({ row }));
};

export const setResolveThreadGitState = async ({
  db,
  sessionId,
  threadId,
  gitState,
}: ThreadParams & { readonly gitState: ResolveThreadGitState | null }): Promise<void> => {
  await db.execute(
    'UPDATE resolve_threads SET git_state = ? WHERE session_id = ? AND thread_id = ?',
    [gitState, sessionId, threadId],
  );
};

export const setResolveThreadVerdict = async ({
  db,
  sessionId,
  threadId,
  verdict,
}: ThreadParams & { readonly verdict: ResolveVerdict | null }): Promise<void> => {
  await db.execute(
    'UPDATE resolve_threads SET verdict_json = ? WHERE session_id = ? AND thread_id = ?',
    [verdict === null ? null : JSON.stringify(verdict), sessionId, threadId],
  );
};

export const setResolveThreadSourceSnapshot = async ({
  db,
  sessionId,
  threadId,
  snapshot,
}: ThreadParams & { readonly snapshot: ResolveSourceSnapshot | null }): Promise<void> => {
  await db.execute(
    'UPDATE resolve_threads SET source_snapshot_json = ? WHERE session_id = ? AND thread_id = ?',
    [snapshot === null ? null : JSON.stringify(snapshot), sessionId, threadId],
  );
};

export const setResolveThreadSource = async ({
  db,
  sessionId,
  threadId,
  sourceKind,
  providerThreadId,
}: ThreadParams & {
  readonly sourceKind: ResolveSourceKind;
  readonly providerThreadId: string | null;
}): Promise<void> => {
  await db.execute(
    'UPDATE resolve_threads SET source_kind = ?, provider_thread_id = ? WHERE session_id = ? AND thread_id = ?',
    [sourceKind, providerThreadId, sessionId, threadId],
  );
};
