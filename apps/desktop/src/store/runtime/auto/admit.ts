import {
  AUTO_MAX_OPEN_CHILDREN,
  AUTO_SUBSTEP_PARENT_SLACK_MS,
  AUTO_SUBSTEPS_PER_PARENT,
  AUTO_TREE_LIMITS,
  diagnoseAdmission,
  isAutoWriterRole,
  sha256Hex,
  type AdmissionChild,
  type AdmissionChildRefusal,
  type AdmissionSnapshot,
  type AdmissionSubstep,
  type AutoDelegationRole,
  type AutoRefusalCode,
} from '@goodboy/core';
import {
  AUTO_ADMISSION_TREE_ABORT,
  autoAdmissionArtifactAbort,
  autoAdmissionSubstepAbort,
  autoAdmissionTreeStatement,
  autoInputArtifactStatements,
  autoReviseArtifactStatements,
  autoSubstepStatements,
  insertAutoDelegationStatement,
  insertAutoReservationStatement,
  listAutoDelegationsOfRequest,
  recordAutoRefusal,
  type AutoDelegation,
  type AutoJsonObject,
  type Database,
  type Statement,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoAttemptId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoReservationId,
  type AutoRequestId,
  type AutoTreeId,
} from '@goodboy/types';
import { readAdmissionSnapshot } from './readAdmissionSnapshot';

const MAX_RACE_RETRIES = 3;

export type AdmitChildInput = Readonly<{
  delegationId: AutoDelegationId;
  childAgentId: AgentId;
  attemptId: AutoAttemptId;
  role: AutoDelegationRole;
  request: AutoJsonObject;
  target: AutoJsonObject;
  routing: AutoJsonObject;
  reviseOf: Readonly<{ artifactId: ArtifactId; expectedRevision: number }> | null;
  inputArtifacts: ReadonlyArray<Readonly<{ artifactId: ArtifactId; revision: number }>>;
  isConfirmForced: boolean;
  deadlineAt: number;
  retryOf?: AutoDelegationId | null;
  substep?: AdmissionSubstep | null;
}>;

export type AdmitBatchParams = Readonly<{
  db: Database;
  treeId: AutoTreeId;
  ownerId: string;
  nowMs: number;
  callerAgentId: AgentId;
  generation: number;
  runId: string;
  requestId: AutoRequestId;
  requestHash: string;
  batchId: AutoBatchId;
  children: ReadonlyArray<AdmitChildInput>;
  isPlanApprovalRequired: boolean;
}>;

type AdmitReceiptEntry = Readonly<{
  delegationId: AutoDelegationId;
  childAgentId: AgentId;
  attemptId: AutoAttemptId;
  role: string;
  state: 'accepted' | 'awaiting_confirm';
}>;

type AdmitReceipt = Readonly<{
  requestId: AutoRequestId;
  batchId: AutoBatchId;
  delegations: ReadonlyArray<AdmitReceiptEntry>;
}>;

export type AdmitOutcome =
  | Readonly<{ kind: 'accepted'; receipt: AdmitReceipt }>
  | Readonly<{ kind: 'replayed'; receipt: AdmitReceipt }>
  | Readonly<{
      kind: 'refused';
      code: AutoRefusalCode;
      perChild: ReadonlyArray<AdmissionChildRefusal>;
    }>;

type ToAdmissionChildParams = {
  readonly child: AdmitChildInput;
};

const toAdmissionChild = ({ child }: ToAdmissionChildParams): AdmissionChild => ({
  childAgentId: child.childAgentId,
  role: child.role,
  reviseOf:
    child.reviseOf === null
      ? null
      : { artifactId: child.reviseOf.artifactId, revision: child.reviseOf.expectedRevision },
  inputArtifacts: child.inputArtifacts.map((ref) => ({
    artifactId: ref.artifactId,
    revision: ref.revision,
  })),
  substep: child.substep ?? null,
});

type ReceiptOfRowsParams = {
  readonly rows: ReadonlyArray<AutoDelegation>;
  readonly requestId: AutoRequestId;
};

const receiptOfRows = ({ rows, requestId }: ReceiptOfRowsParams): AdmitReceipt => {
  const delegations = rows.map((row) => ({
    delegationId: row.id,
    childAgentId: row.childAgentId,
    attemptId: row.firstAttemptId,
    role: row.role,
    state: row.state === 'awaiting_confirm' ? ('awaiting_confirm' as const) : ('accepted' as const),
  }));
  return {
    requestId,
    batchId: rows[0]?.batchId ?? brandId<AutoBatchId>({ value: 'unknown' }),
    delegations,
  };
};

type BuildStatementsParams = {
  readonly params: AdmitBatchParams;
  readonly snapshot: AdmissionSnapshot;
};

type BodyHashOfParams = {
  readonly snapshot: AdmissionSnapshot;
  readonly artifactId: string;
};

const bodyHashOf = ({ snapshot, artifactId }: BodyHashOfParams): string | null => {
  const facts = snapshot.artifacts.find((candidate) => candidate.artifactId === artifactId);
  const live = facts?.live;
  if (live === undefined || live === null) {
    return null;
  }
  return sha256Hex(live.sourceText);
};

const buildStatements = ({ params, snapshot }: BuildStatementsParams): ReadonlyArray<Statement> => {
  const tree = snapshot.tree;
  if (tree === null) {
    return [];
  }
  const statements: Statement[] = [
    autoAdmissionTreeStatement({
      treeId: params.treeId,
      rootAgentId: tree.rootAgentId,
      ownerId: params.ownerId,
      nowMs: params.nowMs,
      generation: params.generation,
      runId: params.runId,
      count: params.children.length,
      limits: {
        maxCallsPerTurn: AUTO_TREE_LIMITS.delegateCallsPerTurn,
        maxRefusals: AUTO_TREE_LIMITS.refusals,
        maxOpenChildren: AUTO_MAX_OPEN_CHILDREN,
      },
    }),
  ];
  for (const [slot, child] of params.children.entries()) {
    if (child.substep !== undefined && child.substep !== null) {
      statements.push(
        ...autoSubstepStatements({
          treeId: params.treeId,
          slot,
          parentDelegationId: brandId<AutoDelegationId>({
            value: child.substep.parentDelegationId,
          }),
          questionId: child.substep.questionId,
          generation: params.generation,
          maxSubsteps: AUTO_SUBSTEPS_PER_PARENT,
          parentDeadlineAt: child.deadlineAt + AUTO_SUBSTEP_PARENT_SLACK_MS,
        }),
      );
    }
    if (child.reviseOf !== null) {
      statements.push(
        ...autoReviseArtifactStatements({
          treeId: params.treeId,
          slot,
          artifactId: child.reviseOf.artifactId,
          expectedRevision: child.reviseOf.expectedRevision,
          childAgentId: child.childAgentId,
          role: child.role,
          delegationId: child.delegationId,
          nowMs: params.nowMs,
        }),
      );
    }
    for (const ref of child.inputArtifacts) {
      const registered = snapshot.artifacts.find((facts) => facts.artifactId === ref.artifactId);
      const isPlan = registered?.registered?.kind === 'plan';
      const isWriter = isAutoWriterRole({ role: child.role });
      statements.push(
        ...autoInputArtifactStatements({
          treeId: params.treeId,
          slot,
          artifactId: ref.artifactId,
          revision: ref.revision,
          isApprovalRequired: params.isPlanApprovalRequired && isPlan && isWriter,
          isConsumed: isPlan && isWriter,
          nowMs: params.nowMs,
        }),
      );
    }
  }
  for (const [slot, child] of params.children.entries()) {
    const revise = child.reviseOf;
    statements.push(
      insertAutoDelegationStatement({
        delegation: {
          id: child.delegationId,
          treeId: params.treeId,
          generation: params.generation,
          requestId: params.requestId,
          requestHash: params.requestHash,
          batchId: params.batchId,
          slot,
          childAgentId: child.childAgentId,
          firstAttemptId: child.attemptId,
          role: child.role,
          request: {
            ...child.request,
            capture:
              revise === null
                ? { mode: 'new' }
                : {
                    mode: 'revise',
                    artifactId: revise.artifactId,
                    baseRevision: revise.expectedRevision,
                    contentHash: bodyHashOf({ snapshot, artifactId: revise.artifactId }),
                  },
            inputArtifacts: child.inputArtifacts.map((ref) => ({
              artifactId: ref.artifactId,
              revision: ref.revision,
              contentHash: bodyHashOf({ snapshot, artifactId: ref.artifactId }),
            })),
          },
          target: child.target,
          routing: child.routing,
          state: child.isConfirmForced ? 'awaiting_confirm' : 'accepted',
          retryOf: child.retryOf ?? null,
          reviseOf: revise === null ? null : revise.artifactId,
          baseRevision: revise === null ? null : revise.expectedRevision,
          isAdopted: false,
          deadlineAt: child.deadlineAt,
          nowMs: params.nowMs,
        },
      }),
      insertAutoReservationStatement({
        id: brandId<AutoReservationId>({ value: `reservation-${child.attemptId}` }),
        treeId: params.treeId,
        ownerKind: 'attempt',
        ownerId: child.attemptId,
        reservedUsd: 0,
        nowMs: params.nowMs,
      }),
    );
  }
  return statements;
};

type RecordRefusalParams = {
  readonly params: AdmitBatchParams;
};

const countRefusal = async ({ params }: RecordRefusalParams): Promise<void> => {
  await recordAutoRefusal({
    db: params.db,
    treeId: params.treeId,
    ownerId: params.ownerId,
    nowMs: params.nowMs,
    generation: params.generation,
    runId: params.runId,
  });
};

type ReplayParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly requestId: AutoRequestId;
  readonly requestHash: string;
};

export const replayAdmission = async ({
  db,
  treeId,
  requestId,
  requestHash,
}: ReplayParams): Promise<AdmitOutcome | null> => {
  const rows = await listAutoDelegationsOfRequest({ db, treeId, requestId });
  if (rows.length === 0) {
    return null;
  }
  if (rows[0]?.requestHash !== requestHash) {
    return { kind: 'refused', code: 'request_conflict', perChild: [] };
  }
  const receipt = receiptOfRows({ rows, requestId });
  return { kind: 'replayed', receipt };
};

type IsRaceAbortParams = {
  readonly abortCode: string;
  readonly slots: number;
};

const isRaceAbort = ({ abortCode, slots }: IsRaceAbortParams): boolean =>
  abortCode === AUTO_ADMISSION_TREE_ABORT ||
  Array.from({ length: slots }, (_, slot) => [
    autoAdmissionArtifactAbort({ slot }),
    autoAdmissionSubstepAbort({ slot }),
  ])
    .flat()
    .includes(abortCode);

export const admitBatch = async (params: AdmitBatchParams): Promise<AdmitOutcome> => {
  const children = params.children.map((child) => toAdmissionChild({ child }));
  for (let attempt = 0; attempt < MAX_RACE_RETRIES; attempt += 1) {
    const replay = await replayAdmission({
      db: params.db,
      treeId: params.treeId,
      requestId: params.requestId,
      requestHash: params.requestHash,
    });
    if (replay !== null) {
      return replay;
    }
    const snapshot = await readAdmissionSnapshot({
      db: params.db,
      treeId: params.treeId,
      ownerId: params.ownerId,
      nowMs: params.nowMs,
      callerAgentId: params.callerAgentId,
      expectedGeneration: params.generation,
      expectedRunId: params.runId,
      children,
      isPlanApprovalRequired: params.isPlanApprovalRequired,
    });
    const verdict = diagnoseAdmission({ snapshot, children });
    if (verdict.kind === 'refused') {
      await countRefusal({ params });
      return { kind: 'refused', code: verdict.code, perChild: verdict.perChild };
    }
    const outcome = await params.db.transaction({
      statements: buildStatements({ params, snapshot }),
    });
    if (outcome.status === 'committed') {
      const entries = params.children.map((child) => ({
        delegationId: child.delegationId,
        childAgentId: child.childAgentId,
        attemptId: child.attemptId,
        role: child.role,
        state: child.isConfirmForced ? ('awaiting_confirm' as const) : ('accepted' as const),
      }));
      return {
        kind: 'accepted',
        receipt: { requestId: params.requestId, batchId: params.batchId, delegations: entries },
      };
    }
    if (!isRaceAbort({ abortCode: outcome.abortCode, slots: params.children.length })) {
      throw new Error(`Auto admission aborted on ${outcome.abortCode}`);
    }
  }
  await countRefusal({ params });
  return { kind: 'refused', code: 'tree_busy', perChild: [] };
};
