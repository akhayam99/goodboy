import {
  AUTO_MAX_OPEN_CHILDREN,
  admissionChildRefusals,
  autoRefusalUserReason,
  type AdmissionChild,
  type AdmissionSnapshot,
  type AutoRefusalCode,
  type DelegateChildSpec,
} from '@goodboy/core/auto';
import {
  autoAdmissionArtifactAbort,
  autoContinueTreeStatement,
  getAutoTree,
  getLatestAutoDelegationOfChild,
  insertAutoDelegationStatement,
  insertAutoReservationStatement,
  listAutoDelegations,
  type AutoDelegation,
  type AutoTree,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoRequestId,
  type AutoReservationId,
  type AutoTreeId,
} from '@goodboy/types';
import type { AutoContinueSource } from '../../../../features/auto/delegationContinueOf';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';
import { admissionStateOf } from '../admission/admissionStateOf';
import { inputArtifactStatementsOf } from '../admission/inputArtifactStatementsOf';
import { readAdmissionSnapshot } from '../admission/readAdmissionSnapshot';
import { prepareRetry } from '../prepareRetry';
import { resolveDelegateChild } from '../resolveDelegateChild';
import type { SleepParams } from '../startDeliveredTurn';
import type { AgentVerbContext } from '../verbContext';
import { delegationDeliveryIdOf } from './delegationDeliveryIdOf';

export type ContinueChildParams = Readonly<{
  ctx: AgentVerbContext;
  childAgentId: AgentId;
  text: string;
  from: AutoContinueSource;
  sleep: (params: SleepParams) => Promise<void>;
  hasFiles?: boolean;
  isBusy?: boolean;
  deliveryId?: string;
  settleWaitMs?: number;
}>;

export type ContinueChildOutcome =
  | Readonly<{ kind: 'continued'; treeId: AutoTreeId; delegationId: AutoDelegationId }>
  | Readonly<{ kind: 'working'; delegationId: AutoDelegationId }>
  | Readonly<{ kind: 'plain' }>
  | Readonly<{ kind: 'refused'; code: string; message: string }>;

const SETTLE_WAIT_MS = 30_000;
const SETTLE_POLL_MS = 250;
const ABORT_DELEGATION = 'continue_delegation';
const ABORT_ARTIFACT = autoAdmissionArtifactAbort({ slot: 0 });

const PLAIN: ContinueChildOutcome = { kind: 'plain' };

const LIVE_PHASES_OFF: ReadonlyArray<AutoTree['phase']> = ['finished', 'stopping', 'stopped'];

const STOP_OUTCOMES: ReadonlyArray<AutoDelegation['outcome']> = ['stopped', 'timed_out'];

type DelegationParams = {
  readonly delegation: AutoDelegation;
};

const isEndedByStop = ({ delegation }: DelegationParams): boolean =>
  delegation.isStopping || STOP_OUTCOMES.includes(delegation.outcome);

const PAUSED_MESSAGE =
  'This agent asked Auto a question and waits for the answer. Your message goes on once Auto answers it.';

const BLOCKED_MESSAGE = 'Auto is blocked. Retry Auto, then write to this agent again.';

const REVISE_MESSAGE =
  'This agent rewrites an artifact for Auto. Ask Auto for the change, and it hands it over.';

const FILES_MESSAGE =
  'An agent Auto started takes text in a message, not files yet. Send the text alone.';

const BUSY_MESSAGE =
  'Auto could not continue this agent right now: the conversation is at its limit of agents, time or money. Try again when an agent is done.';

const REASON_OF = {
  auto: 'Auto continues this agent with new instructions.',
  'auto-message': 'Auto sent this agent a message while it worked.',
  user: 'The user wrote to this agent.',
} as const satisfies Readonly<Record<AutoContinueSource, string>>;

type RefusedParams = {
  readonly code: string;
  readonly message: string;
};

const continueRefused = ({ code, message }: RefusedParams): ContinueChildOutcome => ({
  kind: 'refused',
  code,
  message,
});

type SettledParams = {
  readonly ctx: AgentVerbContext;
  readonly childAgentId: AgentId;
  readonly sleep: (params: SleepParams) => Promise<void>;
  readonly waitMs: number;
};

const settledDelegationOf = async ({
  ctx,
  childAgentId,
  sleep,
  waitMs,
}: SettledParams): Promise<AutoDelegation | null> => {
  const deadline = ctx.now() + waitMs;
  let latest = await getLatestAutoDelegationOfChild({ db: ctx.db, childAgentId });
  while (latest !== null && latest.state !== 'settled' && latest.state !== 'paused') {
    if (ctx.now() >= deadline) {
      return latest;
    }
    await sleep({ ms: SETTLE_POLL_MS });
    latest = await getLatestAutoDelegationOfChild({ db: ctx.db, childAgentId });
  }
  return latest;
};

type DeliveredParams = {
  readonly ctx: AgentVerbContext;
  readonly childAgentId: AgentId;
  readonly deliveryId: string;
};

const deliveredDelegationOf = async ({
  ctx,
  childAgentId,
  deliveryId,
}: DeliveredParams): Promise<AutoDelegation | null> => {
  const latest = await getLatestAutoDelegationOfChild({ db: ctx.db, childAgentId });
  if (latest === null) {
    return null;
  }
  const rows = await listAutoDelegations({ db: ctx.db, treeId: latest.treeId });
  return (
    rows.find(
      (row) =>
        row.childAgentId === childAgentId &&
        delegationDeliveryIdOf({ delegation: row }) === deliveryId,
    ) ?? null
  );
};

type PersonArtifactParams = {
  readonly snapshot: AdmissionSnapshot;
  readonly admission: AdmissionChild;
};

const personArtifactRefusalOf = ({
  snapshot,
  admission,
}: PersonArtifactParams): Readonly<{ code: AutoRefusalCode }> | undefined => {
  const isDiscarded = admission.inputArtifacts.some(
    (ref) =>
      snapshot.artifacts.find((facts) => facts.artifactId === ref.artifactId)?.live?.status ===
      'discarded',
  );
  return isDiscarded ? { code: 'artifact_discarded' } : undefined;
};

type ChildSpecParams = {
  readonly delegation: AutoDelegation;
  readonly text: string;
  readonly from: AutoContinueSource;
};

const childSpecOf = ({ delegation, text, from }: ChildSpecParams): DelegateChildSpec => ({
  role: null,
  title: null,
  task: text,
  reason: REASON_OF[from],
  roleReason: null,
  provider: null,
  model: null,
  effort: null,
  taskType: null,
  difficulty: null,
  doneWhen: null,
  expected: null,
  artifactIds: [],
  mount: null,
  revises: null,
  changeFrom: [],
  publish: null,
  facts: [],
  decisions: [],
  forQuestion: null,
  retryOf: delegation.id,
  replaces: null,
  shouldConfirm: false,
});

export const continueChild = async ({
  ctx,
  childAgentId,
  text,
  from,
  sleep,
  hasFiles = false,
  isBusy = false,
  deliveryId,
  settleWaitMs = SETTLE_WAIT_MS,
}: ContinueChildParams): Promise<ContinueChildOutcome> => {
  if (deliveryId !== undefined) {
    const delivered = await deliveredDelegationOf({ ctx, childAgentId, deliveryId });
    if (delivered !== null) {
      return { kind: 'continued', treeId: delivered.treeId, delegationId: delivered.id };
    }
  }
  const delegation = await settledDelegationOf({
    ctx,
    childAgentId,
    sleep,
    waitMs: isBusy ? 0 : settleWaitMs,
  });
  if (delegation === null) {
    return PLAIN;
  }
  if (from === 'auto-message' && isEndedByStop({ delegation })) {
    return PLAIN;
  }
  const tree = await getAutoTree({ db: ctx.db, treeId: delegation.treeId });
  if (
    tree === null ||
    tree.stopState !== 'none' ||
    LIVE_PHASES_OFF.includes(tree.phase) ||
    tree.generation !== delegation.generation
  ) {
    return PLAIN;
  }
  if (hasFiles) {
    return continueRefused({ code: 'files', message: FILES_MESSAGE });
  }
  if (tree.phase === 'blocked') {
    return continueRefused({ code: 'tree_busy', message: BLOCKED_MESSAGE });
  }
  if (delegation.state === 'paused') {
    return continueRefused({ code: 'not_running', message: PAUSED_MESSAGE });
  }
  if (delegation.state !== 'settled' || isBusy) {
    return { kind: 'working', delegationId: delegation.id };
  }
  if (delegation.reviseOf !== null) {
    return continueRefused({ code: 'artifact_busy', message: REVISE_MESSAGE });
  }
  const isOwner = await ctx.scheduler.claim({ treeId: tree.id });
  if (!isOwner) {
    return continueRefused({
      code: 'not_owner',
      message: autoRefusalUserReason({ code: 'not_owner' }),
    });
  }
  const prepared = await prepareRetry({
    ctx,
    tree,
    child: childSpecOf({ delegation, text, from }),
    slot: 0,
    batchRetries: new Set(),
    batchRebriefs: [],
    isConfirmGated: false,
    from,
  });
  if (prepared.kind !== 'resolve') {
    const code = prepared.kind === 'refused' ? prepared.refusal.code : 'retry_unavailable';
    return continueRefused({ code, message: autoRefusalUserReason({ code }) });
  }
  const workspaceId = textFieldOf({ source: delegation.target, key: 'workspaceId' }) ?? '';
  const resolved = await resolveDelegateChild({
    ctx,
    grant: {
      agentId: tree.rootAgentId,
      treeId: tree.id,
      generation: tree.generation,
      workspaceId,
      sessionId: tree.sessionId,
      runId: `continue-${ctx.ports.newId()}`,
    },
    tree,
    child: prepared.child,
    slot: 0,
    mounts: await ctx.ports.loadMounts({ sessionId: tree.sessionId }),
    retry: prepared.original,
    continueWith: prepared.continueWith,
  });
  if (resolved.kind !== 'ok') {
    return continueRefused({
      code: resolved.refusal.code,
      message: autoRefusalUserReason({ code: resolved.refusal.code }),
    });
  }
  const input = resolved.input;
  const admission: AdmissionChild = {
    childAgentId: input.childAgentId,
    role: input.role,
    reviseOf: null,
    inputArtifacts: input.inputArtifacts,
    substep: null,
  };
  const snapshot = await readAdmissionSnapshot({
    db: ctx.db,
    treeId: tree.id,
    ownerId: ctx.scheduler.ownerId,
    nowMs: ctx.now(),
    callerAgentId: tree.rootAgentId,
    expectedGeneration: tree.generation,
    expectedRunId: tree.activeRunId ?? '',
    children: [admission],
    isPlanApprovalRequired: ctx.ports.isPlanApprovalRequired(),
  });
  const artifactRefusal =
    from === 'user'
      ? personArtifactRefusalOf({ snapshot, admission })
      : admissionChildRefusals({ snapshot, tree, children: [admission] })[0];
  if (artifactRefusal !== undefined) {
    return continueRefused({
      code: artifactRefusal.code,
      message: autoRefusalUserReason({ code: artifactRefusal.code }),
    });
  }
  const nowMs = ctx.now();
  const treeStatement = autoContinueTreeStatement({
    treeId: tree.id,
    ownerId: ctx.scheduler.ownerId,
    nowMs,
    generation: tree.generation,
    maxOpenChildren: AUTO_MAX_OPEN_CHILDREN,
  });
  const outcome = await ctx.db.transaction({
    statements: [
      treeStatement,
      {
        sql: `SELECT 1 FROM auto_delegations
          WHERE id = ? AND state = 'settled'
            AND NOT EXISTS (
              SELECT 1 FROM auto_delegations AS later
              WHERE later.retry_of = auto_delegations.id AND later.state <> 'settled'
            )`,
        params: [delegation.id],
        abortWhen: 'noRows',
        abortCode: ABORT_DELEGATION,
      },
      ...(from === 'user'
        ? []
        : inputArtifactStatementsOf({
            treeId: tree.id,
            slot: 0,
            role: input.role,
            inputArtifacts: input.inputArtifacts,
            snapshot,
            nowMs,
          })),
      insertAutoDelegationStatement({
        delegation: {
          id: input.delegationId,
          treeId: tree.id,
          generation: tree.generation,
          requestId: brandId<AutoRequestId>({ value: `continue-${input.delegationId}` }),
          requestHash: input.delegationId,
          batchId: brandId<AutoBatchId>({ value: ctx.ports.newId() }),
          slot: 0,
          childAgentId: input.childAgentId,
          firstAttemptId: input.attemptId,
          role: input.role,
          request: {
            ...input.request,
            ...(deliveryId !== undefined && { deliveryId }),
            capture: { mode: 'new' },
            inputArtifacts: input.inputArtifacts.map((ref) => ({
              artifactId: ref.artifactId,
              revision: ref.revision,
              contentHash: null,
            })),
          },
          target: input.target,
          routing: input.routing,
          state:
            from === 'user'
              ? 'accepted'
              : admissionStateOf({
                  permissions: snapshot.permissions,
                  role: input.role,
                  isConfirmForced: input.isConfirmForced,
                }),
          retryOf: delegation.id,
          reviseOf: null,
          baseRevision: null,
          isAdopted: false,
          deadlineAt: input.deadlineAt,
          nowMs,
        },
      }),
      insertAutoReservationStatement({
        id: brandId<AutoReservationId>({ value: `reservation-${input.attemptId}` }),
        treeId: tree.id,
        ownerKind: 'attempt',
        ownerId: input.attemptId,
        reservedUsd: 0,
        nowMs,
      }),
    ],
  });
  if (outcome.status === 'aborted') {
    if (outcome.abortCode === treeStatement.abortCode) {
      return continueRefused({ code: 'tree_busy', message: BUSY_MESSAGE });
    }
    if (outcome.abortCode === ABORT_DELEGATION) {
      return { kind: 'working', delegationId: delegation.id };
    }
    if (outcome.abortCode === ABORT_ARTIFACT) {
      return continueRefused({
        code: 'artifact_busy',
        message: autoRefusalUserReason({ code: 'artifact_busy' }),
      });
    }
    throw new Error(`Auto continue aborted on ${outcome.abortCode}`);
  }
  return { kind: 'continued', treeId: tree.id, delegationId: input.delegationId };
};
