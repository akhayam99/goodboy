import type {
  ResolveSourceKind,
  ResolveStage,
  ResolveThread,
  ResolveThreadState,
  SessionId,
} from '@goodboy/types';
import type { Database, PlainStatement } from '../client';
import { keepResolveDraftCurrentStatements } from './resolve-draft-current';
import { resolveStringArray } from './resolve-json';

type BeforeRow = {
  readonly revision: number;
  readonly state: ResolveThreadState;
  readonly disposition: ResolveThread['disposition'];
  readonly replyDraft: string | null;
  readonly commitShas: string | null;
  readonly fixupOfSha: string | null;
  readonly replacesSha: string | null;
  readonly question: string | null;
};
type BookkeepingParams = {
  readonly before: BeforeRow;
  readonly row: ResolveThread;
};

const shaList = ({ json }: { readonly json: string | null }): string | null =>
  json === null ? null : JSON.stringify(resolveStringArray({ json }));

const isBookkeepingWrite = ({ before, row }: BookkeepingParams): boolean =>
  (row.state === before.state || row.state === 'closed') &&
  row.disposition === before.disposition &&
  row.replyDraft === before.replyDraft &&
  row.fixupOfSha === before.fixupOfSha &&
  row.replacesSha === before.replacesSha &&
  row.question === before.question &&
  (row.commitShas === null ? null : JSON.stringify(row.commitShas)) ===
    shaList({ json: before.commitShas });

type Row = Omit<ResolveThread, 'commitShas' | 'githubResolved' | 'sourceKind'> & {
  readonly commitShas: string | null;
  readonly githubResolved: number | null;
  readonly sourceKind: string;
};

const SOURCE_KINDS: ReadonlyArray<ResolveSourceKind> = ['github', 'gitlab', 'bitbucket', 'local'];

const sourceKindOf = ({ row }: { readonly row: ResolveThread }): ResolveSourceKind =>
  row.sourceKind ?? (row.originKind === 'diff_comment' ? 'local' : 'github');
type ListParams = { readonly db: Database; readonly sessionId: SessionId };
type UpsertParams = {
  readonly db: Database;
  readonly row: ResolveThread;
  readonly expectedRevision: number | null;
};
type ReplyDraftParams = ListParams & {
  readonly threadId: string;
  readonly revision: number;
  readonly reply: string;
};

type StateParams = ListParams & {
  readonly threadId: string;
  readonly revision: number;
  readonly state: ResolveThreadState;
  readonly stage: ResolveStage;
  readonly stateReason: string | null;
};

type StageParams = ListParams & {
  readonly threadId: string;
  readonly stage: ResolveStage;
};

export const listResolveThreads = async ({
  db,
  sessionId,
}: ListParams): Promise<ReadonlyArray<ResolveThread>> => {
  const rows = await db.select<Row>(
    `SELECT id, session_id AS sessionId, project_id AS projectId, pr_number AS prNumber, thread_id AS threadId, origin_kind AS originKind, diff_comment_id AS diffCommentId, state, stage, state_reason AS stateReason, revision, generation, reopened_from_thread_id AS reopenedFromThreadId, active_attempt_id AS activeAttemptId, disposition, reply_draft AS replyDraft, commit_shas_json AS commitShas, fixup_of_sha AS fixupOfSha, replaces_sha AS replacesSha, question, reply_posted_at AS replyPostedAt, reply_id AS replyId, github_resolved AS githubResolved, closed_at AS closedAt, closed_source AS closedSource, created_at AS createdAt, updated_at AS updatedAt, source_kind AS sourceKind, provider_thread_id AS providerThreadId FROM resolve_threads WHERE session_id = ? ORDER BY created_at, id`,
    [sessionId],
  );
  return rows.map((row) => ({
    ...row,
    commitShas: row.commitShas === null ? null : resolveStringArray({ json: row.commitShas }),
    githubResolved: row.githubResolved === null ? null : row.githubResolved === 1,
    sourceKind: SOURCE_KINDS.find((kind) => kind === row.sourceKind) ?? 'github',
  }));
};

type UpsertStatementParams = Omit<UpsertParams, 'db'>;

const upsertStatement = ({ row, expectedRevision }: UpsertStatementParams): PlainStatement => ({
  sql: `INSERT INTO resolve_threads (id, session_id, project_id, pr_number, thread_id, origin_kind, diff_comment_id, state, stage, state_reason, revision, generation, reopened_from_thread_id, active_attempt_id, disposition, reply_draft, commit_shas_json, fixup_of_sha, replaces_sha, question, reply_posted_at, reply_id, github_resolved, closed_at, closed_source, created_at, updated_at, source_kind, provider_thread_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, thread_id) DO UPDATE SET
       project_id = excluded.project_id,
       pr_number = excluded.pr_number,
       origin_kind = excluded.origin_kind,
       diff_comment_id = excluded.diff_comment_id,
       state = excluded.state,
       stage = excluded.stage,
       state_reason = excluded.state_reason,
       active_attempt_id = excluded.active_attempt_id,
       disposition = excluded.disposition,
       reply_draft = excluded.reply_draft,
       commit_shas_json = excluded.commit_shas_json,
       fixup_of_sha = excluded.fixup_of_sha,
       replaces_sha = excluded.replaces_sha,
       question = excluded.question,
       reply_posted_at = excluded.reply_posted_at,
       reply_id = excluded.reply_id,
       github_resolved = excluded.github_resolved,
       closed_at = excluded.closed_at,
       closed_source = excluded.closed_source,
       updated_at = excluded.updated_at,
       revision = resolve_threads.revision + 1
     WHERE ? IS NULL OR resolve_threads.revision = ?`,
  params: [
    row.id,
    row.sessionId,
    row.projectId,
    row.prNumber,
    row.threadId,
    row.originKind,
    row.diffCommentId,
    row.state,
    row.stage,
    row.stateReason,
    row.revision,
    row.generation,
    row.reopenedFromThreadId,
    row.activeAttemptId,
    row.disposition,
    row.replyDraft,
    row.commitShas === null ? null : JSON.stringify(row.commitShas),
    row.fixupOfSha,
    row.replacesSha,
    row.question,
    row.replyPostedAt,
    row.replyId,
    row.githubResolved === null ? null : Number(row.githubResolved),
    row.closedAt,
    row.closedSource,
    row.createdAt,
    row.updatedAt,
    sourceKindOf({ row }),
    row.providerThreadId ?? null,
    expectedRevision,
    expectedRevision,
  ],
});

const BEFORE_COLUMNS = `revision, state, disposition, reply_draft AS replyDraft, commit_shas_json AS commitShas,
  fixup_of_sha AS fixupOfSha, replaces_sha AS replacesSha, question`;

export const upsertResolveThread = async ({
  db,
  row,
  expectedRevision,
}: UpsertParams): Promise<boolean> => {
  const statement = upsertStatement({ row, expectedRevision });
  const before = (
    await db.select<BeforeRow>(
      `SELECT ${BEFORE_COLUMNS} FROM resolve_threads WHERE session_id = ? AND thread_id = ?`,
      [row.sessionId, row.threadId],
    )
  )[0];
  if (before === undefined || !isBookkeepingWrite({ before, row })) {
    const result = await db.execute(statement.sql, statement.params);
    return result.rowsAffected > 0;
  }
  const outcome = await db.transaction({
    statements: [
      { ...statement, abortWhen: 'noChanges', abortCode: 'THREAD_CHANGED' },
      ...keepResolveDraftCurrentStatements({
        sessionId: row.sessionId,
        threadId: row.threadId,
        fromRevision: before.revision,
      }),
    ],
  });
  return outcome.status === 'committed';
};

export const setResolveThreadState = async ({
  db,
  sessionId,
  threadId,
  revision,
  state,
  stage,
  stateReason,
}: StateParams): Promise<boolean> => {
  const statement: PlainStatement = {
    sql: `UPDATE resolve_threads SET state = ?, stage = ?, state_reason = ?, revision = revision + 1, updated_at = ?
     WHERE session_id = ? AND thread_id = ? AND revision = ?`,
    params: [state, stage, stateReason, Date.now(), sessionId, threadId, revision],
  };
  if (state !== 'closed') {
    const result = await db.execute(statement.sql, statement.params);
    return result.rowsAffected > 0;
  }
  const outcome = await db.transaction({
    statements: [
      { ...statement, abortWhen: 'noChanges', abortCode: 'THREAD_CHANGED' },
      ...keepResolveDraftCurrentStatements({ sessionId, threadId, fromRevision: revision }),
    ],
  });
  return outcome.status === 'committed';
};

export const setResolveThreadStage = async ({
  db,
  sessionId,
  threadId,
  stage,
}: StageParams): Promise<void> => {
  await db.execute(
    'UPDATE resolve_threads SET stage = ?, updated_at = ? WHERE session_id = ? AND thread_id = ?',
    [stage, Date.now(), sessionId, threadId],
  );
};

type CommitLinksParams = ListParams & {
  readonly threadId: string;
  readonly fixupOfSha: string | null;
  readonly replacesSha: string | null;
};

export const setResolveThreadCommitLinks = async ({
  db,
  sessionId,
  threadId,
  fixupOfSha,
  replacesSha,
}: CommitLinksParams): Promise<void> => {
  await db.execute(
    'UPDATE resolve_threads SET fixup_of_sha = ?, replaces_sha = ? WHERE session_id = ? AND thread_id = ?',
    [fixupOfSha, replacesSha, sessionId, threadId],
  );
};

type CommitShasParams = ListParams & {
  readonly threadId: string;
  readonly commitShas: ReadonlyArray<string>;
};

export const setResolveThreadCommitShas = async ({
  db,
  sessionId,
  threadId,
  commitShas,
}: CommitShasParams): Promise<void> => {
  await db.execute(
    'UPDATE resolve_threads SET commit_shas_json = ? WHERE session_id = ? AND thread_id = ?',
    [JSON.stringify(commitShas), sessionId, threadId],
  );
};

type ReplyPostedParams = ListParams & {
  readonly threadId: string;
  readonly replyId: string;
  readonly postedAt: number;
};

export const setResolveThreadReplyPosted = async ({
  db,
  sessionId,
  threadId,
  replyId,
  postedAt,
}: ReplyPostedParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE resolve_threads SET reply_posted_at = ?, reply_id = ?, updated_at = ?
     WHERE session_id = ? AND thread_id = ? AND reply_posted_at IS NULL`,
    [postedAt, replyId, Date.now(), sessionId, threadId],
  );
  return result.rowsAffected > 0;
};

export const setResolveThreadReplyDraft = async ({
  db,
  sessionId,
  threadId,
  revision,
  reply,
}: ReplyDraftParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE resolve_threads SET reply_draft = ?, updated_at = ?
     WHERE session_id = ? AND thread_id = ? AND revision = ?`,
    [reply, Date.now(), sessionId, threadId, revision],
  );
  return result.rowsAffected > 0;
};
