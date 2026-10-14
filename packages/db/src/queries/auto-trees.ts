import { brandId, type AgentId, type AutoTreeId, type SessionId } from '@goodboy/types';
import type { Database, GuardedStatement } from '../client';

export const AUTO_PHASES = [
  'answering',
  'deciding',
  'delegating',
  'waiting',
  'merging',
  'done',
  'blocked',
  'stopping',
  'stopped',
] as const;

export type AutoPhase = (typeof AUTO_PHASES)[number];

export const AUTO_STOP_STATES = ['none', 'requested', 'confirming', 'confirmed'] as const;

export type AutoStopState = (typeof AUTO_STOP_STATES)[number];

export type AutoTree = Readonly<{
  id: AutoTreeId;
  rootAgentId: AgentId;
  sessionId: SessionId;
  primaryMountId: string | null;
  generation: number;
  phase: AutoPhase;
  phaseRev: number;
  blockedReason: string | null;
  activeRunId: string | null;
  activeDeliveryId: string | null;
  isYieldRequested: boolean;
  stopState: AutoStopState;
  capUsd: number;
  turnsUsed: number;
  delegationsUsed: number;
  attemptsUsed: number;
  refusalsUsed: number;
  turnDelegateCalls: number;
  noProgressStreak: number;
  questionCycles: number;
  grants: number;
  createdAt: number;
  updatedAt: number;
  hardDeadlineAt: number;
  schedulerOwner: string | null;
  ownerLeaseExpiresAt: number | null;
}>;

type TreeRow = {
  readonly id: string;
  readonly root_agent_id: string;
  readonly session_id: string;
  readonly primary_mount_id: string | null;
  readonly generation: number;
  readonly phase: string;
  readonly phase_rev: number;
  readonly blocked_reason: string | null;
  readonly active_run_id: string | null;
  readonly active_delivery_id: string | null;
  readonly is_yield_requested: number;
  readonly stop_state: string;
  readonly cap_usd: number;
  readonly turns_used: number;
  readonly delegations_used: number;
  readonly attempts_used: number;
  readonly refusals_used: number;
  readonly turn_delegate_calls: number;
  readonly no_progress_streak: number;
  readonly question_cycles: number;
  readonly grants: number;
  readonly created_at: number;
  readonly updated_at: number;
  readonly hard_deadline_at: number;
  readonly scheduler_owner: string | null;
  readonly owner_lease_expires_at: number | null;
};

type ValueParams = {
  readonly value: string;
};

const TREE_SELECT = `SELECT id, root_agent_id, session_id, primary_mount_id, generation, phase, phase_rev,
  blocked_reason, active_run_id, active_delivery_id, is_yield_requested, stop_state, cap_usd,
  turns_used, delegations_used, attempts_used, refusals_used, turn_delegate_calls,
  no_progress_streak, question_cycles, grants, created_at, updated_at, hard_deadline_at,
  scheduler_owner, owner_lease_expires_at FROM auto_trees`;

const asPhase = ({ value }: ValueParams): AutoPhase =>
  AUTO_PHASES.find((phase) => phase === value) ?? 'blocked';

const asStopState = ({ value }: ValueParams): AutoStopState =>
  AUTO_STOP_STATES.find((state) => state === value) ?? 'none';

type ToTreeParams = {
  readonly row: TreeRow;
};

const toTree = ({ row }: ToTreeParams): AutoTree => ({
  id: brandId<AutoTreeId>({ value: row.id }),
  rootAgentId: brandId<AgentId>({ value: row.root_agent_id }),
  sessionId: brandId<SessionId>({ value: row.session_id }),
  primaryMountId: row.primary_mount_id,
  generation: row.generation,
  phase: asPhase({ value: row.phase }),
  phaseRev: row.phase_rev,
  blockedReason: row.blocked_reason,
  activeRunId: row.active_run_id,
  activeDeliveryId: row.active_delivery_id,
  isYieldRequested: row.is_yield_requested === 1,
  stopState: asStopState({ value: row.stop_state }),
  capUsd: row.cap_usd,
  turnsUsed: row.turns_used,
  delegationsUsed: row.delegations_used,
  attemptsUsed: row.attempts_used,
  refusalsUsed: row.refusals_used,
  turnDelegateCalls: row.turn_delegate_calls,
  noProgressStreak: row.no_progress_streak,
  questionCycles: row.question_cycles,
  grants: row.grants,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  hardDeadlineAt: row.hard_deadline_at,
  schedulerOwner: row.scheduler_owner,
  ownerLeaseExpiresAt: row.owner_lease_expires_at,
});

export const AUTO_OWNER_GUARD_SQL = 'scheduler_owner = ? AND owner_lease_expires_at > ?';

type OwnerGuardParams = {
  readonly ownerId: string;
  readonly nowMs: number;
};

export const autoOwnerGuardParams = ({
  ownerId,
  nowMs,
}: OwnerGuardParams): ReadonlyArray<unknown> => [ownerId, nowMs];

type GetAutoTreeParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const getAutoTree = async ({ db, treeId }: GetAutoTreeParams): Promise<AutoTree | null> => {
  const rows = await db.select<TreeRow>(`${TREE_SELECT} WHERE id = ?`, [treeId]);
  const row = rows[0];
  return row === undefined ? null : toTree({ row });
};

type GetAutoTreeByRootAgentParams = {
  readonly db: Database;
  readonly rootAgentId: AgentId;
};

export const getAutoTreeByRootAgent = async ({
  db,
  rootAgentId,
}: GetAutoTreeByRootAgentParams): Promise<AutoTree | null> => {
  const rows = await db.select<TreeRow>(`${TREE_SELECT} WHERE root_agent_id = ?`, [rootAgentId]);
  const row = rows[0];
  return row === undefined ? null : toTree({ row });
};

type ListAutoTreesOfSessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listAutoTreesOfSession = async ({
  db,
  sessionId,
}: ListAutoTreesOfSessionParams): Promise<ReadonlyArray<AutoTree>> => {
  const rows = await db.select<TreeRow>(`${TREE_SELECT} WHERE session_id = ? ORDER BY created_at`, [
    sessionId,
  ]);
  return rows.map((row) => toTree({ row }));
};

type ListAutoTreesToRecoverParams = {
  readonly db: Database;
};

export const listAutoTreesToRecover = async ({
  db,
}: ListAutoTreesToRecoverParams): Promise<ReadonlyArray<AutoTree>> => {
  const rows = await db.select<TreeRow>(
    `${TREE_SELECT}
     WHERE phase NOT IN ('answering', 'done', 'stopped') OR stop_state IN ('requested', 'confirming')
     ORDER BY created_at`,
  );
  return rows.map((row) => toTree({ row }));
};

export type AutoAgentWithoutTree = Readonly<{
  agentId: AgentId;
  sessionId: SessionId;
  workspaceId: string;
}>;

type ListAutoAgentsWithoutTreeParams = {
  readonly db: Database;
};

export const listAutoAgentsWithoutTree = async ({
  db,
}: ListAutoAgentsWithoutTreeParams): Promise<ReadonlyArray<AutoAgentWithoutTree>> => {
  const rows = await db.select<{
    readonly id: string;
    readonly session_id: string;
    readonly workspace_id: string;
  }>(
    `SELECT a.id, a.session_id, s.workspace_id
     FROM live_agents a JOIN sessions s ON s.id = a.session_id
     WHERE a.kind = 'auto' AND a.parent_agent_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM auto_trees t WHERE t.root_agent_id = a.id)
     ORDER BY a.session_id, a.ordinal`,
  );
  return rows.map((row) => ({
    agentId: brandId<AgentId>({ value: row.id }),
    sessionId: brandId<SessionId>({ value: row.session_id }),
    workspaceId: row.workspace_id,
  }));
};

export type NewAutoTree = Readonly<{
  id: AutoTreeId;
  rootAgentId: AgentId;
  sessionId: SessionId;
  primaryMountId: string | null;
  capUsd: number;
  nowMs: number;
  hardDeadlineAt: number;
}>;

type InsertAutoTreeParams = {
  readonly db: Database;
  readonly tree: NewAutoTree;
};

export type InsertAutoTreeOutcome = Readonly<{
  tree: AutoTree;
  isCreated: boolean;
}>;

export const insertAutoTree = async ({
  db,
  tree,
}: InsertAutoTreeParams): Promise<InsertAutoTreeOutcome> => {
  const result = await db.execute(
    `INSERT OR IGNORE INTO auto_trees (
       id, root_agent_id, session_id, primary_mount_id, cap_usd, created_at, updated_at,
       hard_deadline_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tree.id,
      tree.rootAgentId,
      tree.sessionId,
      tree.primaryMountId,
      tree.capUsd,
      tree.nowMs,
      tree.nowMs,
      tree.hardDeadlineAt,
    ],
  );
  const stored = await getAutoTreeByRootAgent({ db, rootAgentId: tree.rootAgentId });
  if (stored === null) {
    throw new Error(`Auto tree was not stored for agent ${tree.rootAgentId}`);
  }
  return { tree: stored, isCreated: result.rowsAffected === 1 };
};

type ClaimAutoTreeParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
  readonly nowMs: number;
  readonly leaseMs: number;
};

export const claimAutoTree = async ({
  db,
  treeId,
  ownerId,
  nowMs,
  leaseMs,
}: ClaimAutoTreeParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE auto_trees SET scheduler_owner = ?, owner_lease_expires_at = ?
     WHERE id = ?
       AND (scheduler_owner IS NULL OR scheduler_owner = ? OR owner_lease_expires_at <= ?)`,
    [ownerId, nowMs + leaseMs, treeId, ownerId, nowMs],
  );
  return result.rowsAffected === 1;
};

type ReleaseAutoTreeParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
};

export const releaseAutoTree = async ({
  db,
  treeId,
  ownerId,
}: ReleaseAutoTreeParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE auto_trees SET scheduler_owner = NULL, owner_lease_expires_at = NULL
     WHERE id = ? AND scheduler_owner = ?`,
    [treeId, ownerId],
  );
  return result.rowsAffected === 1;
};

export type AutoTreePhasePatch = Readonly<{
  blockedReason?: string | null;
  activeRunId?: string | null;
  activeDeliveryId?: string | null;
  isYieldRequested?: boolean;
  stopState?: AutoStopState;
  isNewGeneration?: boolean;
  isNewTurn?: boolean;
  noProgressStreak?: number;
}>;

export type AutoTreeExpectation = Readonly<{
  phaseRev: number;
  generation: number;
  from: ReadonlyArray<AutoPhase>;
}>;

type PhaseStatementParams = {
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
  readonly nowMs: number;
  readonly expect: AutoTreeExpectation;
  readonly to: AutoPhase;
  readonly patch?: AutoTreePhasePatch;
  readonly abortCode: string;
};

export const autoTreePhaseStatement = ({
  treeId,
  ownerId,
  nowMs,
  expect,
  to,
  patch = {},
  abortCode,
}: PhaseStatementParams): GuardedStatement => {
  const sets: string[] = ['phase = ?', 'phase_rev = phase_rev + 1', 'updated_at = ?'];
  const setParams: unknown[] = [to, nowMs];
  if (patch.blockedReason !== undefined) {
    sets.push('blocked_reason = ?');
    setParams.push(patch.blockedReason);
  }
  if (patch.activeRunId !== undefined) {
    sets.push('active_run_id = ?');
    setParams.push(patch.activeRunId);
  }
  if (patch.activeDeliveryId !== undefined) {
    sets.push('active_delivery_id = ?');
    setParams.push(patch.activeDeliveryId);
  }
  if (patch.isYieldRequested !== undefined) {
    sets.push('is_yield_requested = ?');
    setParams.push(patch.isYieldRequested ? 1 : 0);
  }
  if (patch.stopState !== undefined) {
    sets.push('stop_state = ?');
    setParams.push(patch.stopState);
  }
  if (patch.isNewGeneration === true) {
    sets.push('generation = generation + 1');
  }
  if (patch.isNewTurn === true) {
    sets.push('turns_used = turns_used + 1', 'turn_delegate_calls = 0');
  }
  if (patch.noProgressStreak !== undefined) {
    sets.push('no_progress_streak = ?');
    setParams.push(patch.noProgressStreak);
  }
  const marks = expect.from.map(() => '?').join(', ');
  return {
    sql: `UPDATE auto_trees SET ${sets.join(', ')}
      WHERE id = ? AND phase_rev = ? AND generation = ? AND phase IN (${marks})
        AND ${AUTO_OWNER_GUARD_SQL}`,
    params: [
      ...setParams,
      treeId,
      expect.phaseRev,
      expect.generation,
      ...expect.from,
      ...autoOwnerGuardParams({ ownerId, nowMs }),
    ],
    abortWhen: 'noChanges',
    abortCode,
  };
};

export type AutoTreeLossReason = 'missing' | 'not_owner' | 'stale';

type DiagnoseLossParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
  readonly nowMs: number;
};

export const diagnoseAutoTreeLoss = async ({
  db,
  treeId,
  ownerId,
  nowMs,
}: DiagnoseLossParams): Promise<AutoTreeLossReason> => {
  const tree = await getAutoTree({ db, treeId });
  if (tree === null) {
    return 'missing';
  }
  const isOwner =
    tree.schedulerOwner === ownerId &&
    tree.ownerLeaseExpiresAt !== null &&
    tree.ownerLeaseExpiresAt > nowMs;
  return isOwner ? 'stale' : 'not_owner';
};

export type AutoTreePhaseOutcome =
  | Readonly<{ kind: 'applied'; tree: AutoTree }>
  | Readonly<{ kind: 'lost'; reason: AutoTreeLossReason }>;

type CasAutoTreePhaseParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
  readonly nowMs: number;
  readonly expect: AutoTreeExpectation;
  readonly to: AutoPhase;
  readonly patch?: AutoTreePhasePatch;
};

export const casAutoTreePhase = async ({
  db,
  treeId,
  ownerId,
  nowMs,
  expect,
  to,
  patch,
}: CasAutoTreePhaseParams): Promise<AutoTreePhaseOutcome> => {
  const statement = autoTreePhaseStatement({
    treeId,
    ownerId,
    nowMs,
    expect,
    to,
    patch,
    abortCode: 'phase_lost',
  });
  const result = await db.execute(statement.sql, statement.params);
  if (result.rowsAffected === 1) {
    const tree = await getAutoTree({ db, treeId });
    if (tree === null) {
      return { kind: 'lost', reason: 'missing' };
    }
    return { kind: 'applied', tree };
  }
  return { kind: 'lost', reason: await diagnoseAutoTreeLoss({ db, treeId, ownerId, nowMs }) };
};

type RecordAutoRefusalParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
  readonly nowMs: number;
};

export const recordAutoRefusal = async ({
  db,
  treeId,
  ownerId,
  nowMs,
}: RecordAutoRefusalParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE auto_trees
     SET refusals_used = refusals_used + 1, turn_delegate_calls = turn_delegate_calls + 1,
         updated_at = ?
     WHERE id = ? AND ${AUTO_OWNER_GUARD_SQL}`,
    [nowMs, treeId, ...autoOwnerGuardParams({ ownerId, nowMs })],
  );
  return result.rowsAffected === 1;
};

type SetAutoTreeCapParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly expectedCapUsd: number;
  readonly capUsd: number;
  readonly nowMs: number;
};

export const setAutoTreeCapIfUnchanged = async ({
  db,
  treeId,
  expectedCapUsd,
  capUsd,
  nowMs,
}: SetAutoTreeCapParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE auto_trees SET cap_usd = ?, phase_rev = phase_rev + 1, updated_at = ?
     WHERE id = ? AND cap_usd = ?`,
    [capUsd, nowMs, treeId, expectedCapUsd],
  );
  return result.rowsAffected === 1;
};

type GrantAutoTreeParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly expectedGrants: number;
  readonly maxGrants: number;
  readonly nowMs: number;
};

export const grantAutoTreeIfUnchanged = async ({
  db,
  treeId,
  expectedGrants,
  maxGrants,
  nowMs,
}: GrantAutoTreeParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE auto_trees SET grants = grants + 1, phase_rev = phase_rev + 1, updated_at = ?
     WHERE id = ? AND grants = ? AND grants < ?`,
    [nowMs, treeId, expectedGrants, maxGrants],
  );
  return result.rowsAffected === 1;
};
