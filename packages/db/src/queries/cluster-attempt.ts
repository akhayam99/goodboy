import type {
  AgentId,
  CheckoutBaseline,
  ClusterAttemptBinding,
  ClusterAttemptSetupResult,
  ClusterAttemptState,
  ClusterAttemptTarget,
  ClusterExecutionEligibility,
  ClusterExecutionEligibilityState,
  ClusterWriteScope,
  IsoDateTime,
  MountId,
  SessionId,
} from '@goodboy/types';
import {
  CLUSTER_ATTEMPT_SETUP_RESULTS,
  CLUSTER_ATTEMPT_STATES,
  CLUSTER_EXECUTION_ELIGIBILITY_STATES,
} from '@goodboy/types';
import type { Database } from '../client';
import { parseStoredWriteScope } from './cluster-execution-graph';

type AttemptRow = {
  readonly id: string;
  readonly request_id: string;
  readonly container_agent_id: string;
  readonly session_id: string;
  readonly node_id: string;
  readonly attempt_number: number;
  readonly graph_revision: number;
  readonly scope_revision: number;
  readonly write_scope_json: string;
  readonly base_sha: string;
  readonly state: string;
  readonly mount_id: string | null;
  readonly mount_revision: number | null;
  readonly branch: string | null;
  readonly worktree_path: string | null;
  readonly repo_root: string | null;
  readonly lease_id: string | null;
  readonly setup_revision: number | null;
  readonly setup_command: string | null;
  readonly setup_result: string;
  readonly setup_exit_code: number | null;
  readonly setup_output: string | null;
  readonly baseline_head_sha: string | null;
  readonly baseline_tree_sha: string | null;
  readonly baseline_status_digest: string | null;
  readonly reason: string | null;
  readonly created_at: number;
  readonly updated_at: number;
};

type EligibilityRow = {
  readonly container_agent_id: string;
  readonly session_id: string;
  readonly graph_revision: number;
  readonly state: string;
  readonly reason: string | null;
  readonly target_mount_id: string | null;
  readonly target_head_sha: string | null;
  readonly evaluated_at: number;
};

const EMPTY_SCOPE: ClusterWriteScope = { version: 1, files: [], directories: [] };

const LIVE_STATES: ReadonlyArray<ClusterAttemptState> = ['claimed', 'allocated', 'prepared'];

type TextParams = {
  readonly value: string;
};

const toAttemptState = ({ value }: TextParams): ClusterAttemptState =>
  CLUSTER_ATTEMPT_STATES.find((state) => state === value) ?? 'failed';

const toSetupResult = ({ value }: TextParams): ClusterAttemptSetupResult =>
  CLUSTER_ATTEMPT_SETUP_RESULTS.find((result) => result === value) ?? 'pending';

const toEligibilityState = ({ value }: TextParams): ClusterExecutionEligibilityState =>
  CLUSTER_EXECUTION_ELIGIBILITY_STATES.find((state) => state === value) ?? 'sequential';

type TimestampParams = {
  readonly value: number;
};

const toIso = ({ value }: TimestampParams): IsoDateTime =>
  new Date(value).toISOString() as IsoDateTime;

const parseScope = ({ value }: TextParams): ClusterWriteScope => {
  try {
    return parseStoredWriteScope({ value: JSON.parse(value) }) ?? EMPTY_SCOPE;
  } catch {
    return EMPTY_SCOPE;
  }
};

type AttemptRowParams = {
  readonly row: AttemptRow;
};

const targetOf = ({ row }: AttemptRowParams): ClusterAttemptTarget | null => {
  if (
    row.mount_id === null ||
    row.mount_revision === null ||
    row.worktree_path === null ||
    row.branch === null ||
    row.repo_root === null
  ) {
    return null;
  }
  return {
    mountId: row.mount_id as MountId,
    mountRevision: row.mount_revision,
    worktreePath: row.worktree_path,
    branch: row.branch,
    repoRoot: row.repo_root,
  };
};

const baselineOf = ({ row }: AttemptRowParams): CheckoutBaseline | null => {
  if (
    row.baseline_head_sha === null ||
    row.baseline_tree_sha === null ||
    row.baseline_status_digest === null
  ) {
    return null;
  }
  return {
    headSha: row.baseline_head_sha,
    treeSha: row.baseline_tree_sha,
    statusDigest: row.baseline_status_digest,
  };
};

const toAttempt = ({ row }: AttemptRowParams): ClusterAttemptBinding => ({
  id: row.id,
  requestId: row.request_id,
  containerAgentId: row.container_agent_id as AgentId,
  sessionId: row.session_id as SessionId,
  nodeId: row.node_id,
  attemptNumber: row.attempt_number,
  graphRevision: row.graph_revision,
  scopeRevision: row.scope_revision,
  writeScope: parseScope({ value: row.write_scope_json }),
  baseSha: row.base_sha,
  state: toAttemptState({ value: row.state }),
  target: targetOf({ row }),
  leaseId: row.lease_id,
  setup: {
    revision: row.setup_revision,
    command: row.setup_command,
    result: toSetupResult({ value: row.setup_result }),
    exitCode: row.setup_exit_code,
    output: row.setup_output,
  },
  baseline: baselineOf({ row }),
  reason: row.reason,
  createdAt: toIso({ value: row.created_at }),
  updatedAt: toIso({ value: row.updated_at }),
});

type EligibilityRowParams = {
  readonly row: EligibilityRow;
};

const toEligibility = ({ row }: EligibilityRowParams): ClusterExecutionEligibility => ({
  containerAgentId: row.container_agent_id as AgentId,
  sessionId: row.session_id as SessionId,
  graphRevision: row.graph_revision,
  state: toEligibilityState({ value: row.state }),
  reason: row.reason,
  targetMountId: row.target_mount_id as MountId | null,
  targetHeadSha: row.target_head_sha,
  evaluatedAt: toIso({ value: row.evaluated_at }),
});

type GetClusterAttemptParams = {
  readonly db: Database;
  readonly id: string;
};

export const getClusterAttempt = async ({
  db,
  id,
}: GetClusterAttemptParams): Promise<ClusterAttemptBinding | null> => {
  const rows = await db.select<AttemptRow>('SELECT * FROM cluster_attempts WHERE id = ?', [id]);
  const row = rows[0];
  return row === undefined ? null : toAttempt({ row });
};

type ByRequestParams = {
  readonly db: Database;
  readonly requestId: string;
};

const findByRequest = async ({
  db,
  requestId,
}: ByRequestParams): Promise<ClusterAttemptBinding | null> => {
  const rows = await db.select<AttemptRow>('SELECT * FROM cluster_attempts WHERE request_id = ?', [
    requestId,
  ]);
  const row = rows[0];
  return row === undefined ? null : toAttempt({ row });
};

type LiveAttemptParams = {
  readonly db: Database;
  readonly containerAgentId: AgentId;
  readonly nodeId: string;
};

const findLiveAttempt = async ({
  db,
  containerAgentId,
  nodeId,
}: LiveAttemptParams): Promise<ClusterAttemptBinding | null> => {
  const rows = await db.select<AttemptRow>(
    `SELECT * FROM cluster_attempts
      WHERE container_agent_id = ? AND node_id = ? AND state IN (?, ?, ?)
      ORDER BY attempt_number DESC LIMIT 1`,
    [containerAgentId, nodeId, ...LIVE_STATES],
  );
  const row = rows[0];
  return row === undefined ? null : toAttempt({ row });
};

export type ClusterAttemptClaim = Readonly<{
  id: string;
  requestId: string;
  containerAgentId: AgentId;
  sessionId: SessionId;
  nodeId: string;
  graphRevision: number;
  scopeRevision: number;
  writeScope: ClusterWriteScope;
  baseSha: string;
  setupRevision: number | null;
  setupCommand: string | null;
}>;

export type ClaimClusterAttemptResult =
  | Readonly<{ kind: 'claimed'; attempt: ClusterAttemptBinding; isNew: boolean }>
  | Readonly<{ kind: 'busy'; attempt: ClusterAttemptBinding }>;

type ClaimClusterAttemptParams = {
  readonly db: Database;
  readonly claim: ClusterAttemptClaim;
};

type SameClaimParams = {
  readonly attempt: ClusterAttemptBinding;
  readonly claim: ClusterAttemptClaim;
};

const assertSameClaim = ({ attempt, claim }: SameClaimParams): void => {
  if (attempt.containerAgentId === claim.containerAgentId && attempt.nodeId === claim.nodeId) {
    return;
  }
  throw new Error(
    `attempt request ${claim.requestId} already belongs to node ${attempt.nodeId} of ${attempt.containerAgentId}`,
  );
};

export const claimClusterAttempt = async ({
  db,
  claim,
}: ClaimClusterAttemptParams): Promise<ClaimClusterAttemptResult> => {
  const existing = await findByRequest({ db, requestId: claim.requestId });
  if (existing !== null) {
    assertSameClaim({ attempt: existing, claim });
    return { kind: 'claimed', attempt: existing, isNew: false };
  }
  const now = Date.now();
  await db.execute(
    `INSERT INTO cluster_attempts
       (id, request_id, container_agent_id, session_id, node_id, attempt_number, graph_revision,
        scope_revision, write_scope_json, base_sha, state, setup_revision, setup_command,
        setup_result, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, COALESCE(MAX(attempt_number), 0) + 1, ?, ?, ?, ?, 'claimed', ?, ?,
            'pending', ?, ?
       FROM cluster_attempts
      WHERE container_agent_id = ? AND node_id = ?
     ON CONFLICT DO NOTHING`,
    [
      claim.id,
      claim.requestId,
      claim.containerAgentId,
      claim.sessionId,
      claim.nodeId,
      claim.graphRevision,
      claim.scopeRevision,
      JSON.stringify(claim.writeScope),
      claim.baseSha,
      claim.setupRevision,
      claim.setupCommand,
      now,
      now,
      claim.containerAgentId,
      claim.nodeId,
    ],
  );
  const inserted = await findByRequest({ db, requestId: claim.requestId });
  if (inserted !== null) {
    assertSameClaim({ attempt: inserted, claim });
    return { kind: 'claimed', attempt: inserted, isNew: inserted.id === claim.id };
  }
  const live = await findLiveAttempt({
    db,
    containerAgentId: claim.containerAgentId,
    nodeId: claim.nodeId,
  });
  if (live === null) {
    throw new Error(`attempt for node ${claim.nodeId} could not be claimed`);
  }
  return { kind: 'busy', attempt: live };
};

type RequireAttemptParams = {
  readonly db: Database;
  readonly id: string;
};

const requireAttempt = async ({ db, id }: RequireAttemptParams): Promise<ClusterAttemptBinding> => {
  const attempt = await getClusterAttempt({ db, id });
  if (attempt === null) {
    throw new Error(`cluster attempt not found: ${id}`);
  }
  return attempt;
};

type BindClusterAttemptMountParams = {
  readonly db: Database;
  readonly id: string;
  readonly target: ClusterAttemptTarget;
};

export const bindClusterAttemptMount = async ({
  db,
  id,
  target,
}: BindClusterAttemptMountParams): Promise<ClusterAttemptBinding> => {
  const result = await db.execute(
    `UPDATE cluster_attempts
        SET mount_id = ?, mount_revision = COALESCE(mount_revision, ?), branch = ?,
            worktree_path = ?, repo_root = ?,
            state = CASE WHEN state = 'claimed' THEN 'allocated' ELSE state END,
            updated_at = ?
      WHERE id = ?
        AND state IN ('claimed', 'allocated', 'prepared')
        AND (mount_id IS NULL OR (mount_id = ? AND worktree_path = ? AND repo_root = ?))`,
    [
      target.mountId,
      target.mountRevision,
      target.branch,
      target.worktreePath,
      target.repoRoot,
      Date.now(),
      id,
      target.mountId,
      target.worktreePath,
      target.repoRoot,
    ],
  );
  const attempt = await requireAttempt({ db, id });
  if (result.rowsAffected === 0) {
    throw new Error(
      `attempt ${id} is ${attempt.state} and bound to ${attempt.target?.worktreePath ?? 'no mount'}; a different target needs a new attempt`,
    );
  }
  return attempt;
};

type BindClusterAttemptLeaseParams = {
  readonly db: Database;
  readonly id: string;
  readonly leaseId: string;
};

export const bindClusterAttemptLease = async ({
  db,
  id,
  leaseId,
}: BindClusterAttemptLeaseParams): Promise<ClusterAttemptBinding> => {
  const result = await db.execute(
    `UPDATE cluster_attempts SET lease_id = ?, updated_at = ?
      WHERE id = ? AND mount_id IS NOT NULL
        AND state IN ('allocated', 'prepared')
        AND (lease_id IS NULL OR lease_id = ?)`,
    [leaseId, Date.now(), id, leaseId],
  );
  const attempt = await requireAttempt({ db, id });
  if (result.rowsAffected === 0) {
    throw new Error(`attempt ${id} cannot take ownership lease ${leaseId}`);
  }
  return attempt;
};

export type ClusterAttemptPreparationRecord = Readonly<{
  result: Exclude<ClusterAttemptSetupResult, 'pending'>;
  exitCode: number | null;
  output: string;
  baseline: CheckoutBaseline | null;
  reason: string | null;
}>;

type RecordClusterAttemptPreparationParams = {
  readonly db: Database;
  readonly id: string;
  readonly preparation: ClusterAttemptPreparationRecord;
};

export const recordClusterAttemptPreparation = async ({
  db,
  id,
  preparation,
}: RecordClusterAttemptPreparationParams): Promise<ClusterAttemptBinding> => {
  const isPrepared = preparation.result === 'succeeded' && preparation.baseline !== null;
  await db.execute(
    `UPDATE cluster_attempts
        SET state = ?, setup_result = ?, setup_exit_code = ?, setup_output = ?,
            baseline_head_sha = ?, baseline_tree_sha = ?, baseline_status_digest = ?,
            reason = ?, updated_at = ?
      WHERE id = ? AND state = 'allocated' AND lease_id IS NOT NULL`,
    [
      isPrepared ? 'prepared' : 'ineligible',
      preparation.result,
      preparation.exitCode,
      preparation.output,
      preparation.baseline?.headSha ?? null,
      preparation.baseline?.treeSha ?? null,
      preparation.baseline?.statusDigest ?? null,
      isPrepared ? null : preparation.reason,
      Date.now(),
      id,
    ],
  );
  return requireAttempt({ db, id });
};

type SettleClusterAttemptParams = {
  readonly db: Database;
  readonly id: string;
  readonly state: Extract<ClusterAttemptState, 'ineligible' | 'failed'>;
  readonly reason: string;
  readonly setupResult?: ClusterAttemptSetupResult;
};

export const settleClusterAttempt = async ({
  db,
  id,
  state,
  reason,
  setupResult,
}: SettleClusterAttemptParams): Promise<ClusterAttemptBinding> => {
  await db.execute(
    `UPDATE cluster_attempts
        SET state = ?, reason = ?, setup_result = COALESCE(?, setup_result), updated_at = ?
      WHERE id = ? AND state IN ('claimed', 'allocated')`,
    [state, reason, setupResult ?? null, Date.now(), id],
  );
  return requireAttempt({ db, id });
};

type ListForSessionsParams = {
  readonly db: Database;
  readonly sessionIds: ReadonlyArray<SessionId>;
};

type PlaceholdersParams = {
  readonly count: number;
};

const placeholders = ({ count }: PlaceholdersParams): string =>
  Array.from({ length: count }, () => '?').join(', ');

export const listClusterAttemptsForSessions = async ({
  db,
  sessionIds,
}: ListForSessionsParams): Promise<
  ReadonlyMap<SessionId, ReadonlyArray<ClusterAttemptBinding>>
> => {
  const grouped = new Map<SessionId, ClusterAttemptBinding[]>();
  if (sessionIds.length === 0) {
    return grouped;
  }
  const rows = await db.select<AttemptRow>(
    `SELECT * FROM cluster_attempts
      WHERE session_id IN (${placeholders({ count: sessionIds.length })})
      ORDER BY created_at ASC, attempt_number ASC`,
    [...sessionIds],
  );
  for (const row of rows) {
    const attempt = toAttempt({ row });
    const bucket = grouped.get(attempt.sessionId) ?? [];
    bucket.push(attempt);
    grouped.set(attempt.sessionId, bucket);
  }
  return grouped;
};

type RecordClusterExecutionEligibilityParams = {
  readonly db: Database;
  readonly eligibility: Omit<ClusterExecutionEligibility, 'evaluatedAt'>;
};

export const recordClusterExecutionEligibility = async ({
  db,
  eligibility,
}: RecordClusterExecutionEligibilityParams): Promise<ClusterExecutionEligibility> => {
  const now = Date.now();
  await db.execute(
    `INSERT INTO cluster_execution_eligibility
       (container_agent_id, session_id, graph_revision, state, reason, target_mount_id,
        target_head_sha, evaluated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(container_agent_id) DO UPDATE SET
       graph_revision = excluded.graph_revision,
       state = excluded.state,
       reason = excluded.reason,
       target_mount_id = excluded.target_mount_id,
       target_head_sha = excluded.target_head_sha,
       evaluated_at = excluded.evaluated_at`,
    [
      eligibility.containerAgentId,
      eligibility.sessionId,
      eligibility.graphRevision,
      eligibility.state,
      eligibility.reason,
      eligibility.targetMountId,
      eligibility.targetHeadSha,
      now,
    ],
  );
  return { ...eligibility, evaluatedAt: toIso({ value: now }) };
};

export const listClusterExecutionEligibilityForSessions = async ({
  db,
  sessionIds,
}: ListForSessionsParams): Promise<
  ReadonlyMap<SessionId, ReadonlyArray<ClusterExecutionEligibility>>
> => {
  const grouped = new Map<SessionId, ClusterExecutionEligibility[]>();
  if (sessionIds.length === 0) {
    return grouped;
  }
  const rows = await db.select<EligibilityRow>(
    `SELECT * FROM cluster_execution_eligibility
      WHERE session_id IN (${placeholders({ count: sessionIds.length })})
      ORDER BY evaluated_at ASC`,
    [...sessionIds],
  );
  for (const row of rows) {
    const eligibility = toEligibility({ row });
    const bucket = grouped.get(eligibility.sessionId) ?? [];
    bucket.push(eligibility);
    grouped.set(eligibility.sessionId, bucket);
  }
  return grouped;
};
