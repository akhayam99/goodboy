import { AUTO_REVISE_ASK_CHARS, sha256Hex } from '@goodboy/core';
import {
  AUTO_OWNER_GUARD_SQL,
  ARTIFACT_REVISION_CONFLICT,
  artifactRevisionWriteStatements,
  autoOwnerGuardParams,
  finishAutoArtifactReviseStatement,
  getAutoArtifactVersionOfAttempt,
  getAutoTree,
  insertAutoArtifactVersionStatement,
  settleAutoDelegationStatement,
  type Database,
  type Statement,
} from '@goodboy/db';
import type { ArtifactId, AutoAttemptId, AutoDelegationId, AutoTreeId } from '@goodboy/types';

export type LandRevisionParams = Readonly<{
  db: Database;
  ownerId: string;
  nowMs: number;
  treeId: AutoTreeId;
  delegationId: AutoDelegationId;
  attemptId: AutoAttemptId;
  generation: number;
  artifactId: ArtifactId;
  baseRevision: number;
  ask: string | null;
  sourceTurnId: string | null;
  title: string;
  sourceText: string;
  metadata: Readonly<Record<string, unknown>>;
  result: unknown;
}>;

export type LandDropReason =
  'generation' | 'not_owner' | 'delegation' | 'attempt' | 'not_open' | 'stale_base';

export type LandRevisionOutcome =
  | Readonly<{ kind: 'landed'; revision: number; contentHash: string }>
  | Readonly<{ kind: 'already_landed'; revision: number; contentHash: string }>
  | Readonly<{ kind: 'dropped'; reason: LandDropReason }>;

const ABORT_TREE = 'land_tree';
const ABORT_DELEGATION = 'land_delegation';
const ABORT_ATTEMPT = 'land_attempt';
const ABORT_OWNERSHIP = 'land_ownership';
const ABORT_FINISH = 'land_finish';
const ABORT_SETTLE = 'land_settle';

type ClipAskParams = {
  readonly ask: string | null;
};

const clipAsk = ({ ask }: ClipAskParams): string | null =>
  ask === null ? null : ask.slice(0, AUTO_REVISE_ASK_CHARS);

const buildStatements = (params: LandRevisionParams): ReadonlyArray<Statement> => [
  {
    sql: `SELECT 1 FROM auto_trees WHERE id = ? AND generation = ? AND ${AUTO_OWNER_GUARD_SQL}`,
    params: [
      params.treeId,
      params.generation,
      ...autoOwnerGuardParams({ ownerId: params.ownerId, nowMs: params.nowMs }),
    ],
    abortWhen: 'noRows',
    abortCode: ABORT_TREE,
  },
  {
    sql: `SELECT 1 FROM auto_delegations
      WHERE id = ? AND tree_id = ? AND generation = ? AND state <> 'settled'
        AND revise_of = ? AND base_revision = ?`,
    params: [
      params.delegationId,
      params.treeId,
      params.generation,
      params.artifactId,
      params.baseRevision,
    ],
    abortWhen: 'noRows',
    abortCode: ABORT_DELEGATION,
  },
  {
    sql: `SELECT 1 FROM auto_attempts
      WHERE id = ? AND delegation_id = ? AND generation = ? AND state = 'ended'
        AND outcome = 'completed'
        AND ordinal = (SELECT MAX(ordinal) FROM auto_attempts WHERE delegation_id = ?)`,
    params: [params.attemptId, params.delegationId, params.generation, params.delegationId],
    abortWhen: 'noRows',
    abortCode: ABORT_ATTEMPT,
  },
  {
    sql: `SELECT 1 FROM auto_artifacts WHERE artifact_id = ? AND open_revise_delegation_id = ?`,
    params: [params.artifactId, params.delegationId],
    abortWhen: 'noRows',
    abortCode: ABORT_OWNERSHIP,
  },
  ...artifactRevisionWriteStatements({
    artifactId: params.artifactId,
    expectedRevision: params.baseRevision,
    isActiveOnly: true,
    author: 'agent',
    ask: clipAsk({ ask: params.ask }),
    sourceTurnId: params.sourceTurnId,
    title: params.title,
    sourceText: params.sourceText,
    metadata: params.metadata,
    nowMs: params.nowMs,
  }),
  insertAutoArtifactVersionStatement({
    artifactId: params.artifactId,
    delegationId: params.delegationId,
    attemptId: params.attemptId,
    baseRevision: params.baseRevision,
    contentHash: sha256Hex(params.sourceText),
    nowMs: params.nowMs,
  }),
  finishAutoArtifactReviseStatement({
    artifactId: params.artifactId,
    delegationId: params.delegationId,
    abortCode: ABORT_FINISH,
  }),
  settleAutoDelegationStatement({
    delegationId: params.delegationId,
    generation: params.generation,
    outcome: 'completed',
    reason: null,
    result: params.result,
    nowMs: params.nowMs,
    abortCode: ABORT_SETTLE,
  }),
  {
    sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
    params: [params.nowMs, params.treeId],
  },
];

const REASON_OF_ABORT: Readonly<Record<string, LandDropReason>> = {
  [ABORT_DELEGATION]: 'delegation',
  [ABORT_ATTEMPT]: 'attempt',
  [ABORT_OWNERSHIP]: 'not_open',
  [ABORT_FINISH]: 'not_open',
  [ABORT_SETTLE]: 'delegation',
  [ARTIFACT_REVISION_CONFLICT]: 'stale_base',
};

const treeReason = async (params: LandRevisionParams): Promise<LandDropReason> => {
  const tree = await getAutoTree({ db: params.db, treeId: params.treeId });
  const isOwner =
    tree !== null &&
    tree.schedulerOwner === params.ownerId &&
    tree.ownerLeaseExpiresAt !== null &&
    tree.ownerLeaseExpiresAt > params.nowMs;
  return isOwner ? 'generation' : 'not_owner';
};

export const landRevision = async (params: LandRevisionParams): Promise<LandRevisionOutcome> => {
  const outcome = await params.db.transaction({ statements: buildStatements(params) });
  if (outcome.status === 'committed') {
    return {
      kind: 'landed',
      revision: params.baseRevision + 1,
      contentHash: sha256Hex(params.sourceText),
    };
  }
  const earlier = await getAutoArtifactVersionOfAttempt({
    db: params.db,
    artifactId: params.artifactId,
    attemptId: params.attemptId,
  });
  if (earlier !== null) {
    return { kind: 'already_landed', revision: earlier.revision, contentHash: earlier.contentHash };
  }
  if (outcome.abortCode === ABORT_TREE) {
    return { kind: 'dropped', reason: await treeReason(params) };
  }
  return { kind: 'dropped', reason: REASON_OF_ABORT[outcome.abortCode] ?? 'delegation' };
};
