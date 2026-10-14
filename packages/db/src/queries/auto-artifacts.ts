import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoTreeId,
} from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement } from '../client';

export const AUTO_APPROVAL_STATES = ['needs_approval', 'approved', 'revising'] as const;

export type AutoApprovalState = (typeof AUTO_APPROVAL_STATES)[number];

export type AutoArtifactKind = 'plan' | 'report' | 'wireframe';

export type AutoArtifact = Readonly<{
  artifactId: ArtifactId;
  treeId: AutoTreeId;
  kind: AutoArtifactKind;
  ownerAgentId: AgentId;
  ownerDelegationId: AutoDelegationId;
  ownerRole: string;
  approvalState: AutoApprovalState;
  approvedRevision: number | null;
  openReviseDelegationId: AutoDelegationId | null;
  rev: number;
  createdAt: number;
}>;

type ArtifactRow = {
  readonly artifact_id: string;
  readonly tree_id: string;
  readonly kind: string;
  readonly owner_agent_id: string;
  readonly owner_delegation_id: string;
  readonly owner_role: string;
  readonly approval_state: string;
  readonly approved_revision: number | null;
  readonly open_revise_delegation_id: string | null;
  readonly rev: number;
  readonly created_at: number;
};

type ValueParams = {
  readonly value: string;
};

const ARTIFACT_SELECT = `SELECT artifact_id, tree_id, kind, owner_agent_id, owner_delegation_id,
  owner_role, approval_state, approved_revision, open_revise_delegation_id, rev, created_at
  FROM auto_artifacts`;

const asApprovalState = ({ value }: ValueParams): AutoApprovalState =>
  AUTO_APPROVAL_STATES.find((state) => state === value) ?? 'needs_approval';

const asKind = ({ value }: ValueParams): AutoArtifactKind =>
  value === 'report' || value === 'wireframe' ? value : 'plan';

type ToArtifactParams = {
  readonly row: ArtifactRow;
};

const toArtifact = ({ row }: ToArtifactParams): AutoArtifact => ({
  artifactId: brandId<ArtifactId>({ value: row.artifact_id }),
  treeId: brandId<AutoTreeId>({ value: row.tree_id }),
  kind: asKind({ value: row.kind }),
  ownerAgentId: brandId<AgentId>({ value: row.owner_agent_id }),
  ownerDelegationId: brandId<AutoDelegationId>({ value: row.owner_delegation_id }),
  ownerRole: row.owner_role,
  approvalState: asApprovalState({ value: row.approval_state }),
  approvedRevision: row.approved_revision,
  openReviseDelegationId:
    row.open_revise_delegation_id === null
      ? null
      : brandId<AutoDelegationId>({ value: row.open_revise_delegation_id }),
  rev: row.rev,
  createdAt: row.created_at,
});

type GetAutoArtifactParams = {
  readonly db: Database;
  readonly artifactId: ArtifactId;
};

export const getAutoArtifact = async ({
  db,
  artifactId,
}: GetAutoArtifactParams): Promise<AutoArtifact | null> => {
  const rows = await db.select<ArtifactRow>(`${ARTIFACT_SELECT} WHERE artifact_id = ?`, [
    artifactId,
  ]);
  const row = rows[0];
  return row === undefined ? null : toArtifact({ row });
};

type ListAutoArtifactsParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const listAutoArtifacts = async ({
  db,
  treeId,
}: ListAutoArtifactsParams): Promise<ReadonlyArray<AutoArtifact>> => {
  const rows = await db.select<ArtifactRow>(
    `${ARTIFACT_SELECT} WHERE tree_id = ? ORDER BY created_at, artifact_id`,
    [treeId],
  );
  return rows.map((row) => toArtifact({ row }));
};

export type NewAutoArtifact = Readonly<{
  artifactId: ArtifactId;
  treeId: AutoTreeId;
  kind: AutoArtifactKind;
  ownerAgentId: AgentId;
  ownerDelegationId: AutoDelegationId;
  ownerRole: string;
  nowMs: number;
}>;

type RegisterAutoArtifactParams = {
  readonly db: Database;
  readonly artifact: NewAutoArtifact;
};

export type RegisterAutoArtifactOutcome = Readonly<{
  artifact: AutoArtifact;
  isCreated: boolean;
}>;

export const registerAutoArtifact = async ({
  db,
  artifact,
}: RegisterAutoArtifactParams): Promise<RegisterAutoArtifactOutcome> => {
  const result = await db.execute(
    `INSERT OR IGNORE INTO auto_artifacts (
       artifact_id, tree_id, kind, owner_agent_id, owner_delegation_id, owner_role, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      artifact.artifactId,
      artifact.treeId,
      artifact.kind,
      artifact.ownerAgentId,
      artifact.ownerDelegationId,
      artifact.ownerRole,
      artifact.nowMs,
    ],
  );
  const stored = await getAutoArtifact({ db, artifactId: artifact.artifactId });
  if (stored === null) {
    throw new Error(`Auto artifact was not stored for ${artifact.artifactId}`);
  }
  return { artifact: stored, isCreated: result.rowsAffected === 1 };
};

export type AutoApproveOutcome =
  | Readonly<{ kind: 'approved'; revision: number }>
  | Readonly<{ kind: 'unknown' }>
  | Readonly<{ kind: 'revising'; revision: number }>
  | Readonly<{ kind: 'stale_revision'; revision: number }>
  | Readonly<{ kind: 'consumed'; revision: number }>
  | Readonly<{ kind: 'discarded'; revision: number }>;

type ApproveAutoArtifactParams = {
  readonly db: Database;
  readonly artifactId: ArtifactId;
  readonly expectedRevision: number;
};

export type AutoArtifactLiveState = {
  readonly revision: number;
  readonly status: string;
  readonly sourceText: string;
  readonly title: string;
};

type ReadAutoArtifactLiveStateParams = {
  readonly db: Database;
  readonly artifactId: ArtifactId;
};

export const readAutoArtifactLiveState = async ({
  db,
  artifactId,
}: ReadAutoArtifactLiveStateParams): Promise<AutoArtifactLiveState | null> => {
  const rows = await db.select<AutoArtifactLiveState>(
    'SELECT revision, status, source_text AS sourceText, title FROM session_artifacts WHERE id = ?',
    [artifactId],
  );
  return rows[0] ?? null;
};

export const approveAutoArtifact = async ({
  db,
  artifactId,
  expectedRevision,
}: ApproveAutoArtifactParams): Promise<AutoApproveOutcome> => {
  const outcome = await db.transaction({
    statements: [
      {
        sql: `UPDATE auto_artifacts
          SET approval_state = 'approved', approved_revision = ?, rev = rev + 1
          WHERE artifact_id = ?
            AND approval_state IN ('needs_approval', 'approved')
            AND open_revise_delegation_id IS NULL
            AND (SELECT revision FROM session_artifacts WHERE id = auto_artifacts.artifact_id) = ?
            AND (SELECT status FROM session_artifacts WHERE id = auto_artifacts.artifact_id) = 'active'`,
        params: [expectedRevision, artifactId, expectedRevision],
        abortWhen: 'noChanges',
        abortCode: 'approve_refused',
      },
    ],
  });
  if (outcome.status === 'committed') {
    return { kind: 'approved', revision: expectedRevision };
  }
  const registered = await getAutoArtifact({ db, artifactId });
  const live = await readAutoArtifactLiveState({ db, artifactId });
  if (registered === null || live === null) {
    return { kind: 'unknown' };
  }
  if (registered.openReviseDelegationId !== null) {
    return { kind: 'revising', revision: live.revision };
  }
  if (live.status === 'discarded') {
    return { kind: 'discarded', revision: live.revision };
  }
  if (live.status === 'consumed') {
    return { kind: 'consumed', revision: live.revision };
  }
  return { kind: 'stale_revision', revision: live.revision };
};

export type AutoArtifactVersion = Readonly<{
  artifactId: ArtifactId;
  revision: number;
  delegationId: AutoDelegationId;
  attemptId: AutoAttemptId;
  baseRevision: number | null;
  contentHash: string;
  createdAt: number;
}>;

type VersionRow = {
  readonly artifact_id: string;
  readonly revision: number;
  readonly delegation_id: string;
  readonly attempt_id: string;
  readonly base_revision: number | null;
  readonly content_hash: string;
  readonly created_at: number;
};

const VERSION_SELECT = `SELECT artifact_id, revision, delegation_id, attempt_id, base_revision,
  content_hash, created_at FROM auto_artifact_versions`;

type ToVersionParams = {
  readonly row: VersionRow;
};

const toVersion = ({ row }: ToVersionParams): AutoArtifactVersion => ({
  artifactId: brandId<ArtifactId>({ value: row.artifact_id }),
  revision: row.revision,
  delegationId: brandId<AutoDelegationId>({ value: row.delegation_id }),
  attemptId: brandId<AutoAttemptId>({ value: row.attempt_id }),
  baseRevision: row.base_revision,
  contentHash: row.content_hash,
  createdAt: row.created_at,
});

type ListAutoArtifactVersionsParams = {
  readonly db: Database;
  readonly artifactId: ArtifactId;
};

export const listAutoArtifactVersions = async ({
  db,
  artifactId,
}: ListAutoArtifactVersionsParams): Promise<ReadonlyArray<AutoArtifactVersion>> => {
  const rows = await db.select<VersionRow>(
    `${VERSION_SELECT} WHERE artifact_id = ? ORDER BY revision`,
    [artifactId],
  );
  return rows.map((row) => toVersion({ row }));
};

type GetAutoArtifactVersionOfAttemptParams = {
  readonly db: Database;
  readonly artifactId: ArtifactId;
  readonly attemptId: AutoAttemptId;
};

export const getAutoArtifactVersionOfAttempt = async ({
  db,
  artifactId,
  attemptId,
}: GetAutoArtifactVersionOfAttemptParams): Promise<AutoArtifactVersion | null> => {
  const rows = await db.select<VersionRow>(
    `${VERSION_SELECT} WHERE artifact_id = ? AND attempt_id = ?`,
    [artifactId, attemptId],
  );
  const row = rows[0];
  return row === undefined ? null : toVersion({ row });
};

type InsertVersionStatementParams = {
  readonly artifactId: ArtifactId;
  readonly delegationId: AutoDelegationId;
  readonly attemptId: AutoAttemptId;
  readonly baseRevision: number | null;
  readonly contentHash: string;
  readonly nowMs: number;
};

export const insertAutoArtifactVersionStatement = ({
  artifactId,
  delegationId,
  attemptId,
  baseRevision,
  contentHash,
  nowMs,
}: InsertVersionStatementParams): PlainStatement => ({
  sql: `INSERT INTO auto_artifact_versions (
      artifact_id, revision, delegation_id, attempt_id, base_revision, content_hash, created_at
    ) SELECT id, revision, ?, ?, ?, ?, ? FROM session_artifacts WHERE id = ?`,
  params: [delegationId, attemptId, baseRevision, contentHash, nowMs, artifactId],
});

type ResetApprovalStatementParams = {
  readonly artifactId: ArtifactId;
  readonly delegationId: AutoDelegationId;
  readonly abortCode: string;
};

export const finishAutoArtifactReviseStatement = ({
  artifactId,
  delegationId,
  abortCode,
}: ResetApprovalStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_artifacts
    SET approval_state = 'needs_approval', approved_revision = NULL,
        open_revise_delegation_id = NULL, rev = rev + 1
    WHERE artifact_id = ? AND open_revise_delegation_id = ?`,
  params: [artifactId, delegationId],
  abortWhen: 'noChanges',
  abortCode,
});

export type AutoArtifactLedgerRow = Readonly<{
  artifact: AutoArtifact;
  title: string;
  revision: number;
  status: string;
  sourceText: string;
  updatedAt: number;
  lastAuthor: string | null;
  lastAsk: string | null;
}>;

type LedgerRow = ArtifactRow & {
  readonly title: string;
  readonly revision: number;
  readonly status: string;
  readonly source_text: string;
  readonly updated_at: number;
  readonly last_author: string | null;
  readonly last_ask: string | null;
};

type ListAutoArtifactLedgerParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const listAutoArtifactLedger = async ({
  db,
  treeId,
}: ListAutoArtifactLedgerParams): Promise<ReadonlyArray<AutoArtifactLedgerRow>> => {
  const rows = await db.select<LedgerRow>(
    `SELECT a.artifact_id, a.tree_id, a.kind, a.owner_agent_id, a.owner_delegation_id, a.owner_role,
       a.approval_state, a.approved_revision, a.open_revise_delegation_id, a.rev, a.created_at,
       s.title, s.revision, s.status, s.source_text, s.updated_at,
       r.author AS last_author, r.ask AS last_ask
     FROM auto_artifacts a
     JOIN session_artifacts s ON s.id = a.artifact_id
     LEFT JOIN artifact_revisions r ON r.artifact_id = s.id AND r.revision = s.revision
     WHERE a.tree_id = ?
     ORDER BY s.updated_at DESC, a.artifact_id`,
    [treeId],
  );
  return rows.map((row) => ({
    artifact: toArtifact({ row }),
    title: row.title,
    revision: row.revision,
    status: row.status,
    sourceText: row.source_text,
    updatedAt: row.updated_at,
    lastAuthor: row.last_author,
    lastAsk: row.last_ask,
  }));
};
