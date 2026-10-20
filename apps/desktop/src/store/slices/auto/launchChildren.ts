import {
  composeAnswerKickoff,
  isAutoProviderResuming,
  isAutoWriterRole,
  type AutoDelegationRole,
} from '@goodboy/core';
import {
  getAutoAttempt,
  getAutoTree,
  listAutoAttemptsOfDelegation,
  listOpenAutoDelegations,
  mergeAutoAttemptBaselineStatement,
  type AutoAttempt,
  type AutoDelegation,
  type AutoTree,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { remoteJson, remoteOf, resumeOf, snapshotJson, snapshotOf } from './attemptBaseline';
import { carriedSnapshot } from './carriedSnapshot';
import { childImagesOf } from './childImagesOf';
import { delegationRoleOf } from './attemptEnvelope';
import { failAttempt } from './failAttempt';
import type { ChildMountTarget, ChildStartOutcome, ChildTurnEnded } from './ports';
import { readSnapshot } from './readSnapshot';
import type { AgentVerbContext } from './verbContext';

export type LaunchChildrenParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
  onChildEnded: (ended: ChildTurnEnded) => void;
}>;

export type LaunchChildrenOutcome = Readonly<{
  delegationIds: ReadonlyArray<string>;
  done: Promise<void>;
}>;

const launching = new Set<string>();

type MountTargetParams = {
  readonly delegation: AutoDelegation;
};

const mountTargetOf = ({ delegation }: MountTargetParams): ChildMountTarget | null => {
  const mountId = delegation.target['mountId'];
  const mountRevision = delegation.target['mountRevision'];
  const worktreePath = delegation.target['worktreePath'];
  if (
    typeof mountId !== 'string' ||
    typeof mountRevision !== 'number' ||
    typeof worktreePath !== 'string'
  ) {
    return null;
  }
  return { mountId, mountRevision, worktreePath };
};

type AttemptToLaunchParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly role: AutoDelegationRole;
  readonly target: ChildMountTarget;
};

const attemptToLaunch = async ({
  ctx,
  tree,
  delegation,
  role,
  target,
}: AttemptToLaunchParams): Promise<AutoAttempt | null> => {
  const isWriter = isAutoWriterRole({ role });
  if (delegation.state === 'accepted') {
    const carried = await carriedSnapshot({ ctx, delegation, worktreePath: target.worktreePath });
    const snapshot =
      carried ?? (await readSnapshot({ ports: ctx.ports, worktreePath: target.worktreePath }));
    const remote = isWriter
      ? await ctx.ports.readRemoteHead({ worktreePath: target.worktreePath, branch: null })
      : null;
    const started = await ctx.scheduler.startAttempt({
      treeId: tree.id,
      delegationId: delegation.id,
      generation: tree.generation,
      baseline: { ...snapshotJson({ snapshot, nowMs: ctx.now() }), ...remoteJson({ remote }) },
      writeSet: isWriter ? { worktreePath: target.worktreePath } : null,
    });
    return started.kind === 'started' ? started.attempt : null;
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
  const latest = attempts[attempts.length - 1];
  if (latest === undefined || latest.state !== 'starting' || latest.runId !== null) {
    return null;
  }
  const isSnapshotMissing = snapshotOf({ baseline: latest.baseline }) === null;
  const isRemoteMissing = isWriter && remoteOf({ baseline: latest.baseline }) === null;
  if (isSnapshotMissing || isRemoteMissing) {
    const snapshot = isSnapshotMissing
      ? await readSnapshot({ ports: ctx.ports, worktreePath: target.worktreePath })
      : null;
    const remote = isRemoteMissing
      ? await ctx.ports.readRemoteHead({ worktreePath: target.worktreePath, branch: null })
      : null;
    const merge = mergeAutoAttemptBaselineStatement({
      attemptId: latest.id,
      patch: {
        ...(isSnapshotMissing ? snapshotJson({ snapshot, nowMs: ctx.now() }) : {}),
        ...remoteJson({ remote }),
      },
    });
    await ctx.db.execute(merge.sql, merge.params);
  }
  return getAutoAttempt({ db: ctx.db, attemptId: latest.id });
};

type TextParams = {
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
};

const kickoffTextOf = ({ delegation, attempt }: TextParams): string => {
  const resume = resumeOf({ baseline: attempt.baseline });
  const kickoff = delegation.request['kickoff'];
  const brief = typeof kickoff === 'string' ? kickoff : '';
  if (resume !== null) {
    const provider = delegation.routing['provider'];
    const isResuming = typeof provider === 'string' && isAutoProviderResuming({ provider });
    return composeAnswerKickoff({
      childAgentId: delegation.childAgentId,
      question: resume.question,
      answer: resume.answer,
      memory: isResuming ? null : { brief, tail: resume.tail },
      report: resume.report,
    });
  }
  return brief;
};

type BriefVersionFieldParams = {
  readonly delegation: AutoDelegation;
};

const briefVersionField = ({
  delegation,
}: BriefVersionFieldParams): { readonly briefVersion?: number } => {
  const stored = delegation.request['briefVersion'];
  return typeof stored === 'number' ? { briefVersion: stored } : {};
};

type LaunchOneParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly onChildEnded: (ended: ChildTurnEnded) => void;
};

type StartParams = LaunchOneParams & {
  readonly attempt: AutoAttempt;
  readonly role: AutoDelegationRole;
  readonly target: ChildMountTarget;
};

const startTurn = async ({
  ctx,
  tree,
  delegation,
  attempt,
  role,
  target,
  onChildEnded,
}: StartParams): Promise<ChildStartOutcome> => {
  const existing = await ctx.ports.lookupDeliveryRun({ deliveryId: attempt.id });
  if (existing !== null) {
    return { kind: 'duplicate', runId: existing.runId };
  }
  const current = await getAutoTree({ db: ctx.db, treeId: tree.id });
  if (
    current === null ||
    current.generation !== tree.generation ||
    current.stopState !== 'none' ||
    current.phase === 'stopping' ||
    current.phase === 'stopped'
  ) {
    return { kind: 'refused', reason: 'kickoff_failed', message: 'The work was stopped.' };
  }
  try {
    return await ctx.ports.startChildTurn({
      treeId: tree.id,
      generation: tree.generation,
      delegationId: delegation.id,
      attemptId: attempt.id,
      childAgentId: delegation.childAgentId,
      sessionId: tree.sessionId,
      role,
      text: kickoffTextOf({ delegation, attempt }),
      images: await childImagesOf({ ctx, tree, delegation }),
      mountTarget: target,
      runId: ctx.ports.newId(),
      captureMode: delegation.reviseOf === null ? 'new' : 'revise',
      ...briefVersionField({ delegation }),
      onEnded: onChildEnded,
    });
  } catch (error) {
    return { kind: 'refused', reason: 'kickoff_failed', message: formatError(error) };
  }
};

type ReasonParams = {
  readonly code: string;
  readonly message: string;
};

const reasonOf = ({ code, message }: ReasonParams): string =>
  message.trim() === '' ? code : `${code}: ${message.trim()}`;

const launchOne = async (params: LaunchOneParams): Promise<void> => {
  const { ctx, tree, delegation } = params;
  const role = delegationRoleOf({ delegation });
  const target = mountTargetOf({ delegation });
  if (target === null) {
    return;
  }
  const attempt = await attemptToLaunch({ ctx, tree, delegation, role, target });
  if (attempt === null) {
    return;
  }
  const fail = (reason: string) =>
    failAttempt({ ctx, delegation, attempt, generation: tree.generation, reason });
  try {
    await ctx.ports.ensureChildAgent({
      delegation,
      sessionId: tree.sessionId,
      parentAgentId: tree.rootAgentId,
    });
  } catch (error) {
    await fail(reasonOf({ code: 'kickoff_failed', message: formatError(error) }));
    return;
  }
  const outcome = await startTurn({ ...params, attempt, role, target });
  if (outcome.kind === 'refused') {
    await fail(reasonOf({ code: outcome.reason, message: outcome.message }));
    return;
  }
  const marked = await ctx.scheduler.markAttemptRunning({
    attemptId: attempt.id,
    delegationId: delegation.id,
    generation: tree.generation,
    runId: outcome.runId,
  });
  if (marked === 'lost') {
    await ctx.ports.cancelRun({ sessionId: tree.sessionId, agentId: delegation.childAgentId });
  }
};

export const launchChildren = async ({
  ctx,
  treeId,
  onChildEnded,
}: LaunchChildrenParams): Promise<LaunchChildrenOutcome> => {
  const none: LaunchChildrenOutcome = { delegationIds: [], done: Promise.resolve() };
  const isOwner = await ctx.scheduler.claim({ treeId });
  const tree = isOwner ? await getAutoTree({ db: ctx.db, treeId }) : null;
  if (
    tree === null ||
    tree.stopState !== 'none' ||
    tree.activeRunId !== null ||
    (tree.phase !== 'delegating' && tree.phase !== 'waiting')
  ) {
    return none;
  }
  const open = await listOpenAutoDelegations({ db: ctx.db, treeId });
  const launchable = open.filter(
    (delegation) =>
      (delegation.state === 'accepted' || delegation.state === 'starting') &&
      !launching.has(delegation.id),
  );
  for (const delegation of launchable) {
    launching.add(delegation.id);
  }
  const launchGuarded = async (delegation: AutoDelegation): Promise<void> => {
    try {
      await launchOne({ ctx, tree, delegation, onChildEnded });
    } finally {
      launching.delete(delegation.id);
    }
  };
  return {
    delegationIds: launchable.map((delegation) => delegation.id),
    done: Promise.all(launchable.map(launchGuarded)).then(() => undefined),
  };
};
