import {
  AUTO_DELEGATION_DEADLINE_MINUTES,
  AUTO_DELIVERY_ARTIFACT_CHARS,
  AUTO_MAX_OPEN_CHILDREN,
  diagnoseResume,
  isAutoWriterRole,
} from '@goodboy/core';
import {
  AUTO_RESUME_TREE_ABORT,
  autoResumeTreeStatement,
  casAutoDelegationStateStatement,
  getAutoArtifact,
  getAutoDelegation,
  insertAutoAttemptStatement,
  insertAutoReservationStatement,
  listAutoAttemptsOfDelegation,
  readAutoArtifactLiveState,
  type AutoAttempt,
  type AutoDelegation,
  type Statement,
} from '@goodboy/db';
import {
  brandId,
  type ArtifactId,
  type AutoAttemptId,
  type AutoDelegationId,
  type AutoReservationId,
} from '@goodboy/types';
import { resumeOf } from './attemptBaseline';
import { delegationRoleOf } from './attemptEnvelope';
import type { AgentCommand, BridgeOutcome } from './ports';
import { readAdmissionSnapshot } from './readAdmissionSnapshot';
import { refuseOutcome } from './refuseOutcome';
import type { AgentVerbContext } from './verbContext';
import { isRecord } from '@goodboy/types/helpers';

export type AnswerQuestionParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

const ABORT_ATTEMPT = 'answer_attempt';
const ABORT_DELEGATION = 'answer_delegation';
const ANSWER_CHARS = 8_000;
const ANSWERED_REASON = 'answered';

type TextParams = {
  readonly value: unknown;
  readonly max: number;
};

const textOf = ({ value, max }: TextParams): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
};

type QuestionTextParams = {
  readonly attempt: AutoAttempt;
};

const questionTextOf = ({ attempt }: QuestionTextParams): string => {
  const snapshot = attempt.resultSnapshot;
  const question = isRecord(snapshot) ? snapshot['question'] : undefined;
  return typeof question === 'string' ? question : '';
};

const questionTailOf = ({ attempt }: QuestionTextParams): string => {
  const snapshot = attempt.resultSnapshot;
  const tail = isRecord(snapshot) ? snapshot['tail'] : undefined;
  return typeof tail === 'string' ? tail : '';
};

type ReportParams = {
  readonly ctx: AgentVerbContext;
  readonly treeId: AutoAttempt['treeId'];
  readonly artifactText: string;
};

const reportOf = async ({ ctx, treeId, artifactText }: ReportParams): Promise<string | null> => {
  const artifactId = brandId<ArtifactId>({ value: artifactText });
  const registered = await getAutoArtifact({ db: ctx.db, artifactId });
  const live = await readAutoArtifactLiveState({ db: ctx.db, artifactId });
  if (registered === null || registered.treeId !== treeId || live === null) {
    return null;
  }
  const body = live.sourceText.slice(0, AUTO_DELIVERY_ARTIFACT_CHARS);
  return `${live.title} (version ${live.revision})\n${body}`;
};

type ResumeOfQuestionParams = {
  readonly attempts: ReadonlyArray<AutoAttempt>;
  readonly questionId: string;
};

const resumeAttemptOf = ({ attempts, questionId }: ResumeOfQuestionParams): AutoAttempt | null =>
  attempts.find((attempt) => resumeOf({ baseline: attempt.baseline })?.questionId === questionId) ??
  null;

type ReplayParams = {
  readonly prior: AutoAttempt;
  readonly delegation: AutoDelegation;
  readonly questionId: string;
  readonly text: string;
};

const NEXT_HINT =
  'End your turn when you have nothing else to hand over. The agent continues when it is over, and its result comes back to you as a message.';

const replayOutcome = ({ prior, delegation, questionId, text }: ReplayParams): BridgeOutcome => {
  if (resumeOf({ baseline: prior.baseline })?.answer !== text) {
    return refuseOutcome({
      code: 'request_conflict',
      message: 'That question was already answered with a different text.',
    });
  }
  return {
    isOk: true,
    data: {
      answered: true,
      replayed: true,
      delegationId: delegation.id,
      attemptId: prior.id,
      questionId,
      next: NEXT_HINT,
    },
  };
};

type RefusalAfterAbortParams = {
  readonly ctx: AgentVerbContext;
  readonly command: AgentCommand;
};

const refusalAfterTreeAbort = async ({
  ctx,
  command,
}: RefusalAfterAbortParams): Promise<BridgeOutcome> => {
  const { grant } = command;
  const snapshot = await readAdmissionSnapshot({
    db: ctx.db,
    treeId: grant.treeId,
    ownerId: ctx.scheduler.ownerId,
    nowMs: ctx.now(),
    callerAgentId: grant.agentId,
    expectedGeneration: grant.generation,
    expectedRunId: grant.runId,
    children: [],
    isPlanApprovalRequired: ctx.ports.isPlanApprovalRequired(),
  });
  const verdict = diagnoseResume({ snapshot });
  return refuseOutcome({ code: verdict.kind === 'refused' ? verdict.code : 'tree_busy' });
};

export const answerQuestion = async ({
  ctx,
  command,
}: AnswerQuestionParams): Promise<BridgeOutcome> => {
  const { grant, args } = command;
  const delegationText = textOf({ value: args['delegation'], max: 1_000 });
  const questionId = textOf({ value: args['question'], max: 1_000 });
  const text = textOf({ value: args['text'], max: ANSWER_CHARS });
  if (delegationText === null || questionId === null || text === null) {
    return refuseOutcome({
      code: 'spec_invalid',
      message: 'answer needs --delegation, --question and --text',
    });
  }
  const isOwner = await ctx.scheduler.claim({ treeId: grant.treeId });
  if (!isOwner) {
    return refuseOutcome({ code: 'not_owner' });
  }
  const delegation = await getAutoDelegation({
    db: ctx.db,
    delegationId: brandId<AutoDelegationId>({ value: delegationText }),
  });
  if (delegation === null || delegation.treeId !== grant.treeId) {
    return refuseOutcome({ code: 'delegation_unknown' });
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
  const prior = resumeAttemptOf({ attempts, questionId });
  if (prior !== null) {
    return replayOutcome({ prior, delegation, questionId, text });
  }
  const paused = attempts.find((attempt) => attempt.questionId === questionId);
  if (paused === undefined) {
    return refuseOutcome({ code: 'question_unknown' });
  }
  const latest = attempts[attempts.length - 1];
  if (delegation.state !== 'paused' || paused.state !== 'paused' || latest?.id !== paused.id) {
    return refuseOutcome({ code: 'not_paused' });
  }
  const artifactText = textOf({ value: args['artifact'], max: 1_000 });
  const report =
    artifactText === null ? null : await reportOf({ ctx, treeId: grant.treeId, artifactText });
  if (artifactText !== null && report === null) {
    return refuseOutcome({ code: 'artifact_unknown' });
  }
  const nowMs = ctx.now();
  const role = delegationRoleOf({ delegation });
  const snapshot = await readAdmissionSnapshot({
    db: ctx.db,
    treeId: grant.treeId,
    ownerId: ctx.scheduler.ownerId,
    nowMs,
    callerAgentId: grant.agentId,
    expectedGeneration: grant.generation,
    expectedRunId: grant.runId,
    children: [],
    isPlanApprovalRequired: ctx.ports.isPlanApprovalRequired(),
  });
  const verdict = diagnoseResume({ snapshot });
  const tree = snapshot.tree;
  if (verdict.kind === 'refused' || tree === null) {
    return refuseOutcome({ code: verdict.kind === 'refused' ? verdict.code : 'not_owner' });
  }
  const attemptId = brandId<AutoAttemptId>({ value: ctx.ports.newId() });
  const worktreePath = delegation.target['worktreePath'];
  const statements: Statement[] = [
    {
      sql: `SELECT 1 FROM auto_attempts WHERE id = ? AND state = 'paused' AND question_id = ?`,
      params: [paused.id, questionId],
      abortWhen: 'noRows',
      abortCode: ABORT_ATTEMPT,
    },
    autoResumeTreeStatement({
      treeId: tree.id,
      rootAgentId: tree.rootAgentId,
      ownerId: ctx.scheduler.ownerId,
      nowMs,
      generation: grant.generation,
      runId: grant.runId,
      maxOpenChildren: AUTO_MAX_OPEN_CHILDREN,
    }),
    casAutoDelegationStateStatement({
      delegationId: delegation.id,
      generation: grant.generation,
      from: ['paused'],
      to: 'starting',
      abortCode: ABORT_DELEGATION,
    }),
    {
      sql: 'UPDATE auto_delegations SET deadline_at = ? WHERE id = ?',
      params: [nowMs + AUTO_DELEGATION_DEADLINE_MINUTES * 60_000, delegation.id],
    },
    insertAutoAttemptStatement({
      id: attemptId,
      delegationId: delegation.id,
      treeId: tree.id,
      generation: grant.generation,
      baseline: {
        resume: {
          questionId,
          question: questionTextOf({ attempt: paused }),
          answer: text,
          tail: questionTailOf({ attempt: paused }),
          ...(report === null ? {} : { report }),
        },
      },
      writeSet:
        isAutoWriterRole({ role }) && typeof worktreePath === 'string' ? { worktreePath } : null,
      nowMs,
    }),
    insertAutoReservationStatement({
      id: brandId<AutoReservationId>({ value: `reservation-${attemptId}` }),
      treeId: tree.id,
      ownerKind: 'attempt',
      ownerId: attemptId,
      reservedUsd: 0,
      nowMs,
    }),
    {
      sql: `UPDATE auto_outbox SET state = 'dropped', dropped_reason = ?
        WHERE tree_id = ? AND join_key = ? AND state = 'pending'`,
      params: [ANSWERED_REASON, tree.id, `question:${paused.id}`],
    },
  ];
  const outcome = await ctx.db.transaction({ statements });
  if (outcome.status === 'aborted') {
    if (outcome.abortCode === AUTO_RESUME_TREE_ABORT) {
      return refusalAfterTreeAbort({ ctx, command });
    }
    if (outcome.abortCode !== ABORT_ATTEMPT && outcome.abortCode !== ABORT_DELEGATION) {
      throw new Error(`Auto answer aborted on ${outcome.abortCode}`);
    }
    const after = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
    const raced = resumeAttemptOf({ attempts: after, questionId });
    return raced === null
      ? refuseOutcome({ code: 'not_paused' })
      : replayOutcome({ prior: raced, delegation, questionId, text });
  }
  return {
    isOk: true,
    data: {
      answered: true,
      replayed: false,
      delegationId: delegation.id,
      attemptId,
      questionId,
      next: NEXT_HINT,
    },
  };
};
