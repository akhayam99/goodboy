import {
  attributeChanges,
  isAutoWriterRole,
  parseChildClosing,
  parseRevisionFromTurn,
  sha256Hex,
  AUTO_TREE_LIMITS,
  type ChildClosing,
  type DelegationResultV1,
  type ResultArtifact,
  type ResultChangedFile,
} from '@goodboy/core';
import {
  getArtifact,
  getAutoAttempt,
  getAutoDelegation,
  getAutoOutbox,
  getAutoTree,
  listArtifactsOfRun,
  registerAutoArtifact,
  type AutoAttempt,
  type AutoDelegation,
  type AutoTree,
  type NewAutoOutbox,
} from '@goodboy/db';
import { brandId, type ArtifactId, type AutoOutboxId } from '@goodboy/types';
import { snapshotOf } from './attemptBaseline';
import { attemptEnvelope, delegationRoleOf, isArtifactRole } from './attemptEnvelope';
import { landAttemptRevision, type RevisionLanding } from './landAttemptRevision';
import type { ChildTurnEnded } from './ports';
import { readSnapshot } from './readSnapshot';
import type { SettleAttemptOutcome } from './settleAttempt';
import type { AgentVerbContext } from './verbContext';

export type FinishAttemptParams = Readonly<{
  ctx: AgentVerbContext;
  ended: ChildTurnEnded;
}>;

export type FinishAttemptOutcome =
  | Readonly<{ kind: 'paused'; questionId: string }>
  | Readonly<{ kind: 'ended'; outcome: string; landing: 'landed' | 'failed' | 'none' }>
  | Readonly<{ kind: 'dropped'; reason: string }>;

type Context = {
  readonly ctx: AgentVerbContext;
  readonly ended: ChildTurnEnded;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly closing: ChildClosing;
};

const QUESTION_ID_PREFIX = 'question-';

const pausedAttempt = async ({
  ctx,
  ended,
  tree,
  delegation,
  attempt,
  closing,
}: Context): Promise<FinishAttemptOutcome> => {
  const question = closing.question;
  if (question === null) {
    return { kind: 'dropped', reason: 'no_question' };
  }
  const questionId = `${QUESTION_ID_PREFIX}${attempt.id}`;
  const outbox: NewAutoOutbox = {
    id: brandId<AutoOutboxId>({ value: ctx.ports.newId() }),
    treeId: tree.id,
    generation: tree.generation,
    kind: 'question',
    joinKey: `question:${attempt.id}`,
    payload: {
      kind: 'question',
      delegationId: delegation.id,
      attemptId: attempt.id,
      questionId,
      role: delegationRoleOf({ delegation }),
      childAgentId: delegation.childAgentId,
      text: question.text,
      suggestedAnswers: question.suggestedAnswers,
      recommendedAnswer: question.recommendedAnswer,
    },
    nowMs: ctx.now(),
  };
  const settled = await ctx.scheduler.settleAttempt({
    attemptId: attempt.id,
    generation: ended.generation,
    ending: {
      kind: 'paused',
      questionId,
      costUsd: ended.costUsd,
      resultSnapshot: { question: question.text, tail: closing.summary },
    },
    outbox: [outbox],
  });
  return settled.kind === 'settled'
    ? { kind: 'paused', questionId }
    : { kind: 'dropped', reason: settled.reason };
};

type ArtifactsOfParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly tree: AutoTree;
  readonly ended: ChildTurnEnded;
};

const capturedArtifacts = async ({
  ctx,
  delegation,
  tree,
  ended,
}: ArtifactsOfParams): Promise<ReadonlyArray<ResultArtifact>> => {
  const captured = await listArtifactsOfRun({
    db: ctx.db,
    agentId: delegation.childAgentId,
    runId: ended.runId,
  });
  const results: ResultArtifact[] = [];
  for (const artifact of captured) {
    await registerAutoArtifact({
      db: ctx.db,
      artifact: {
        artifactId: artifact.artifactId,
        treeId: tree.id,
        kind: artifact.kind,
        ownerAgentId: delegation.childAgentId,
        ownerDelegationId: delegation.id,
        ownerRole: delegation.role,
        nowMs: ctx.now(),
      },
    });
    results.push({
      id: artifact.artifactId,
      kind: artifact.kind,
      title: artifact.title,
      contentHash: sha256Hex(artifact.sourceText),
      revision: artifact.revision,
      baseRevision: null,
    });
  }
  return results;
};

type AttributionParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
};

type Attribution = Readonly<{
  changedFiles: ReadonlyArray<ResultChangedFile>;
  hasReadOnlyViolation: boolean;
}>;

const attributionOf = async ({
  ctx,
  delegation,
  attempt,
}: AttributionParams): Promise<Attribution> => {
  const worktreePath = delegation.target['worktreePath'];
  if (typeof worktreePath !== 'string') {
    return { changedFiles: [], hasReadOnlyViolation: false };
  }
  const result = await readSnapshot({ ports: ctx.ports, worktreePath });
  const attributed = attributeChanges({
    baseline: snapshotOf({ baseline: attempt.baseline }),
    result,
    isWriter: isAutoWriterRole({ role: delegationRoleOf({ delegation }) }),
  });
  return {
    changedFiles: attributed.changedFiles,
    hasReadOnlyViolation: attributed.hasReadOnlyViolation,
  };
};

type AskParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
};

const askOf = async ({ ctx, delegation }: AskParams): Promise<string | null> => {
  const rowIds = delegation.request['changeFrom'];
  const texts: string[] = [];
  if (Array.isArray(rowIds)) {
    for (const rowId of rowIds) {
      if (typeof rowId !== 'string') {
        continue;
      }
      const row = await getAutoOutbox({
        db: ctx.db,
        outboxId: brandId<AutoOutboxId>({ value: rowId }),
      });
      const payload = row?.payload;
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'text' in payload &&
        typeof payload.text === 'string'
      ) {
        texts.push(payload.text);
      }
    }
  }
  if (texts.length > 0) {
    return texts.join('\n');
  }
  const task = delegation.request['task'];
  return typeof task === 'string' && task !== '' ? task : null;
};

type ReviseParams = Context & {
  readonly attribution: Attribution;
};

const finishedRevise = async (params: ReviseParams): Promise<FinishAttemptOutcome> => {
  const { ctx, ended, tree, delegation, attempt, closing, attribution } = params;
  const artifactId = delegation.reviseOf;
  const baseRevision = delegation.baseRevision;
  if (artifactId === null || baseRevision === null) {
    return { kind: 'dropped', reason: 'not_a_revise' };
  }
  const base = await getArtifact({
    db: ctx.db,
    artifactId: brandId<ArtifactId>({ value: artifactId }),
  });
  const baseClusters = base?.kind === 'plan' ? (base.metadata.clusters?.length ?? 0) : 0;
  const parsed =
    ended.exit === 'ok'
      ? parseRevisionFromTurn({
          assistantText: ended.assistantText,
          expectedKind: base?.kind ?? 'plan',
          baseClusterCount: baseClusters,
        })
      : ({ kind: 'failed', reason: 'no_new_version' } as const);
  const artifacts: ReadonlyArray<ResultArtifact> =
    parsed.kind === 'ok' && base !== null
      ? [
          {
            id: artifactId,
            kind: base.kind,
            title: parsed.title,
            contentHash: sha256Hex(parsed.sourceText),
            revision: baseRevision + 1,
            baseRevision,
          },
        ]
      : [];
  const envelope = attemptEnvelope({
    delegation,
    attempt,
    generation: ended.generation,
    exit: ended.exit,
    closing,
    changedFiles: attribution.changedFiles,
    artifacts,
    artifactPersistence: parsed.kind === 'ok' ? 'ok' : 'failed',
    costUsd: ended.costUsd,
    durationMs: ended.durationMs,
  });
  const landing: RevisionLanding | null =
    parsed.kind === 'ok'
      ? {
          title: parsed.title,
          sourceText: parsed.sourceText,
          metadata: parsed.metadata,
          ask: await askOf({ ctx, delegation }),
          sourceTurnId: ended.runId,
        }
      : null;
  const settled = await ctx.scheduler.settleAttempt({
    attemptId: attempt.id,
    generation: ended.generation,
    ending: {
      kind: 'ended',
      outcome: parsed.kind === 'ok' ? 'completed' : 'failed',
      endReason: parsed.kind === 'ok' ? null : parsed.reason,
      costUsd: ended.costUsd,
      resultSnapshot: { envelope, landing },
    },
  });
  if (settled.kind === 'dropped') {
    return { kind: 'dropped', reason: settled.reason };
  }
  if (parsed.kind === 'failed') {
    await ctx.scheduler.failRevise({
      treeId: tree.id,
      delegationId: delegation.id,
      generation: ended.generation,
      artifactId: brandId<ArtifactId>({ value: artifactId }),
      reason: parsed.reason,
      result: { ...envelope, outcome: 'failed', reason: parsed.reason },
    });
    return { kind: 'ended', outcome: 'failed', landing: 'failed' };
  }
  const fresh = await getAutoAttempt({ db: ctx.db, attemptId: attempt.id });
  const landed =
    fresh === null
      ? null
      : await landAttemptRevision({
          ctx,
          delegation,
          attempt: fresh,
          generation: ended.generation,
        });
  return {
    kind: 'ended',
    outcome: landed?.kind === 'failed' ? 'failed' : 'completed',
    landing: landed?.kind === 'landed' || landed?.kind === 'already_landed' ? 'landed' : 'failed',
  };
};

type LimitParams = {
  readonly delegation: AutoDelegation;
};

const isOverQuestionLimit = ({ delegation }: LimitParams): boolean =>
  delegation.questionCycles + 1 > AUTO_TREE_LIMITS.questionCyclesPerDelegation;

type PlainOutcomeParams = {
  readonly params: ReviseParams;
  readonly envelope: DelegationResultV1;
};

type PlainOutcome = Readonly<{
  outcome: DelegationResultV1['outcome'];
  reason: string | null;
}>;

const plainOutcomeOf = ({ params, envelope }: PlainOutcomeParams): PlainOutcome => {
  const { ended, delegation, closing, attribution } = params;
  if (attribution.hasReadOnlyViolation && ended.exit === 'ok') {
    return { outcome: 'failed', reason: 'role_read_only_violation' };
  }
  if (closing.question !== null && ended.exit === 'ok' && isOverQuestionLimit({ delegation })) {
    return { outcome: 'blocked', reason: 'question_limit' };
  }
  return { outcome: envelope.outcome, reason: envelope.reason };
};

const finishedPlain = async (params: ReviseParams): Promise<FinishAttemptOutcome> => {
  const { ctx, ended, tree, delegation, attempt, closing, attribution } = params;
  const artifacts = isArtifactRole({ delegation })
    ? await capturedArtifacts({ ctx, delegation, tree, ended })
    : [];
  const envelope = attemptEnvelope({
    delegation,
    attempt,
    generation: ended.generation,
    exit: ended.exit,
    closing,
    changedFiles: attribution.changedFiles,
    artifacts,
    artifactPersistence: isArtifactRole({ delegation })
      ? artifacts.length > 0
        ? 'ok'
        : 'failed'
      : 'not_applicable',
    costUsd: ended.costUsd,
    durationMs: ended.durationMs,
  });
  const { outcome, reason } = plainOutcomeOf({ params, envelope });
  const settled: SettleAttemptOutcome = await ctx.scheduler.settleAttempt({
    attemptId: attempt.id,
    generation: ended.generation,
    ending: {
      kind: 'ended',
      outcome,
      endReason: reason,
      costUsd: ended.costUsd,
      resultSnapshot: { envelope: { ...envelope, outcome, reason } },
    },
  });
  return settled.kind === 'settled'
    ? { kind: 'ended', outcome, landing: 'none' }
    : { kind: 'dropped', reason: settled.reason };
};

export const finishAttempt = async ({
  ctx,
  ended,
}: FinishAttemptParams): Promise<FinishAttemptOutcome> => {
  const tree = await getAutoTree({ db: ctx.db, treeId: ended.treeId });
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId: ended.delegationId });
  const attempt = await getAutoAttempt({ db: ctx.db, attemptId: ended.attemptId });
  if (tree === null || delegation === null || attempt === null) {
    return { kind: 'dropped', reason: 'unknown' };
  }
  const isCurrent =
    tree.generation === ended.generation &&
    attempt.generation === ended.generation &&
    (attempt.state === 'starting' || attempt.state === 'running') &&
    (attempt.runId === null || attempt.runId === ended.runId);
  if (!isCurrent) {
    return { kind: 'dropped', reason: 'stale' };
  }
  const closing = parseChildClosing({
    text: ended.assistantText,
    childAgentId: delegation.childAgentId,
  });
  const context: Context = { ctx, ended, tree, delegation, attempt, closing };
  if (closing.question !== null && ended.exit === 'ok' && !isOverQuestionLimit({ delegation })) {
    return pausedAttempt(context);
  }
  const attribution = await attributionOf({ ctx, delegation, attempt });
  return delegation.reviseOf === null
    ? finishedPlain({ ...context, attribution })
    : finishedRevise({ ...context, attribution });
};
