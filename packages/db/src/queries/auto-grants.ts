import {
  brandId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoTreeId,
} from '@goodboy/types';
import type { Database, GuardedStatement, PlainStatement } from '../client';

export const AUTO_GRANT_KINDS = ['dependency', 'protected_file', 'pull_request'] as const;

export type AutoGrantKind = (typeof AUTO_GRANT_KINDS)[number];

export const AUTO_GRANT_STATES = ['asked', 'allowed', 'declined', 'used'] as const;

export type AutoGrantState = (typeof AUTO_GRANT_STATES)[number];

export type AutoGrantAnswer = Extract<AutoGrantState, 'allowed' | 'declined'>;

export type AutoGrantId = string & { readonly __brand: 'AutoGrantId' };

export type AutoGrant = Readonly<{
  id: AutoGrantId;
  treeId: AutoTreeId;
  delegationId: AutoDelegationId | null;
  attemptId: AutoAttemptId | null;
  textVersion: string | null;
  kind: AutoGrantKind;
  subject: string;
  state: AutoGrantState;
  isCurrent: boolean;
  answeredAt: number | null;
  createdAt: number;
}>;

type GrantRow = {
  readonly id: string;
  readonly tree_id: string;
  readonly delegation_id: string | null;
  readonly attempt_id: string | null;
  readonly text_version: string | null;
  readonly kind: string;
  readonly subject: string;
  readonly state: string;
  readonly is_current: number;
  readonly answered_at: number | null;
  readonly created_at: number;
};

type RefParams = {
  readonly ref: string;
};

const currentGrantSql = ({ ref }: RefParams): string => `(
  ((${ref}.attempt_id IS NULL AND EXISTS (
    SELECT 1 FROM auto_delegations owner JOIN auto_trees owner_tree ON owner_tree.id = owner.tree_id
    WHERE owner.id = ${ref}.delegation_id AND owner.generation = owner_tree.generation
  )) OR EXISTS (
    SELECT 1 FROM auto_attempts bound JOIN auto_trees tree ON tree.id = bound.tree_id
    WHERE bound.id = ${ref}.attempt_id AND bound.generation = tree.generation
      AND NOT EXISTS (
        SELECT 1 FROM auto_attempts later
        WHERE later.delegation_id = bound.delegation_id AND later.ordinal > bound.ordinal
      )
  ))
  AND (${ref}.text_version IS NULL OR NOT EXISTS (
    SELECT 1 FROM auto_grants newer
    WHERE newer.tree_id = ${ref}.tree_id AND newer.kind = ${ref}.kind
      AND newer.subject = ${ref}.subject AND newer.text_version IS NOT NULL
      AND newer.rowid > ${ref}.rowid
  ))
)`;

const GRANT_SELECT = `SELECT grant_row.id, grant_row.tree_id, grant_row.delegation_id,
  grant_row.attempt_id, grant_row.text_version, grant_row.kind, grant_row.subject,
  grant_row.state, ${currentGrantSql({ ref: 'grant_row' })} AS is_current,
  grant_row.answered_at, grant_row.created_at
  FROM auto_grants grant_row`;

type ValueParams = {
  readonly value: string;
};

const grantKindOf = ({ value }: ValueParams): AutoGrantKind =>
  AUTO_GRANT_KINDS.find((kind) => kind === value) ?? 'dependency';

const grantStateOf = ({ value }: ValueParams): AutoGrantState =>
  AUTO_GRANT_STATES.find((state) => state === value) ?? 'asked';

type ToGrantParams = {
  readonly row: GrantRow;
};

const toGrant = ({ row }: ToGrantParams): AutoGrant => ({
  id: brandId<AutoGrantId>({ value: row.id }),
  treeId: brandId<AutoTreeId>({ value: row.tree_id }),
  delegationId:
    row.delegation_id === null ? null : brandId<AutoDelegationId>({ value: row.delegation_id }),
  attemptId: row.attempt_id === null ? null : brandId<AutoAttemptId>({ value: row.attempt_id }),
  textVersion: row.text_version,
  kind: grantKindOf({ value: row.kind }),
  subject: row.subject,
  state: grantStateOf({ value: row.state }),
  isCurrent: row.is_current === 1,
  answeredAt: row.answered_at,
  createdAt: row.created_at,
});

export type NewAutoGrant = Readonly<{
  id: AutoGrantId;
  treeId: AutoTreeId;
  delegationId: AutoDelegationId | null;
  attemptId: AutoAttemptId | null;
  textVersion: string | null;
  kind: AutoGrantKind;
  subject: string;
  nowMs: number;
}>;

type InsertGrantStatementParams = {
  readonly grant: NewAutoGrant;
};

export const insertAutoGrantStatement = ({
  grant,
}: InsertGrantStatementParams): PlainStatement => ({
  sql: `INSERT INTO auto_grants (
      id, tree_id, delegation_id, attempt_id, text_version, kind, subject, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING`,
  params: [
    grant.id,
    grant.treeId,
    grant.delegationId,
    grant.attemptId,
    grant.textVersion,
    grant.kind,
    grant.subject,
    grant.nowMs,
    grant.nowMs,
  ],
});

type GetGrantParams = {
  readonly db: Database;
  readonly grantId: AutoGrantId;
};

export const getAutoGrant = async ({ db, grantId }: GetGrantParams): Promise<AutoGrant | null> => {
  const rows = await db.select<GrantRow>(`${GRANT_SELECT} WHERE grant_row.id = ?`, [grantId]);
  const row = rows[0];
  return row === undefined ? null : toGrant({ row });
};

type ListGrantsOfTreeParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const listAutoGrantsOfTree = async ({
  db,
  treeId,
}: ListGrantsOfTreeParams): Promise<ReadonlyArray<AutoGrant>> => {
  const rows = await db.select<GrantRow>(
    `${GRANT_SELECT} WHERE grant_row.tree_id = ? ORDER BY grant_row.rowid`,
    [treeId],
  );
  return rows.map((row) => toGrant({ row }));
};

type ListAllowancesParams = {
  readonly db: Database;
  readonly delegationId: AutoDelegationId;
};

export const listAutoGrantAllowances = async ({
  db,
  delegationId,
}: ListAllowancesParams): Promise<ReadonlyArray<AutoGrant>> => {
  const rows = await db.select<GrantRow>(
    `${GRANT_SELECT} WHERE grant_row.delegation_id = ? AND grant_row.state = 'allowed'
      AND grant_row.attempt_id IS NOT NULL ORDER BY grant_row.rowid`,
    [delegationId],
  );
  return rows.map((row) => toGrant({ row }));
};

type AnswerGrantStatementParams = {
  readonly grantId: AutoGrantId;
  readonly answer: AutoGrantAnswer;
  readonly nowMs: number;
  readonly abortCode: string;
  readonly fromState?: Extract<AutoGrantState, 'asked' | 'declined'>;
};

export const answerAutoGrantStatement = ({
  grantId,
  answer,
  nowMs,
  abortCode,
  fromState = 'asked',
}: AnswerGrantStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_grants SET state = ?, answered_at = ?, updated_at = ?
    WHERE id = ? AND state = ? AND ${currentGrantSql({ ref: 'auto_grants' })}`,
  params: [answer, nowMs, nowMs, grantId, fromState],
  abortWhen: 'noChanges',
  abortCode,
});

type AllowedGuardParams = {
  readonly grantId: AutoGrantId;
  readonly abortCode: string;
};

export const allowedAutoGrantGuard = ({
  grantId,
  abortCode,
}: AllowedGuardParams): GuardedStatement => ({
  sql: `SELECT 1 FROM auto_grants
    WHERE id = ? AND state = 'allowed' AND ${currentGrantSql({ ref: 'auto_grants' })}`,
  params: [grantId],
  abortWhen: 'noRows',
  abortCode,
});

type MarkUsedStatementParams = {
  readonly grantId: AutoGrantId;
  readonly nowMs: number;
  readonly abortCode: string;
};

export const markAutoGrantUsedStatement = ({
  grantId,
  nowMs,
  abortCode,
}: MarkUsedStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_grants SET state = 'used', updated_at = ? WHERE id = ? AND state = 'allowed'`,
  params: [nowMs, grantId],
  abortWhen: 'noChanges',
  abortCode,
});
