import { parseDelegateSpec, parseProposeSpec } from '@goodboy/core';
import { getAutoTree, recordAutoRefusal } from '@goodboy/db';
import { brandId, type AutoBatchId, type AutoRequestId } from '@goodboy/types';
import { replayAdmission, type AdmitChildInput, type AdmitOutcome } from './admit';
import { delegationReceipt } from './delegationReceipt';
import type { AgentCommand, BridgeOutcome } from './ports';
import { prepareRetry, type RecoveredRevise } from './prepareRetry';
import { refuseOutcome } from './refuseOutcome';
import { resolveDelegateChild } from './resolveDelegateChild';
import type { AgentVerbContext } from './verbContext';

export type DelegateParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
  isProposal?: boolean;
}>;

type TextParams = {
  readonly value: unknown;
};

const textOf = ({ value }: TextParams): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

type CountedRefusalParams = {
  readonly ctx: AgentVerbContext;
  readonly command: AgentCommand;
  readonly outcome: BridgeOutcome;
};

const countedRefusal = async ({
  ctx,
  command,
  outcome,
}: CountedRefusalParams): Promise<BridgeOutcome> => {
  await recordAutoRefusal({
    db: ctx.db,
    treeId: command.grant.treeId,
    ownerId: ctx.scheduler.ownerId,
    nowMs: ctx.now(),
    generation: command.grant.generation,
    runId: command.grant.runId,
  });
  return outcome;
};

type ReceiptOutcomeParams = {
  readonly ctx: AgentVerbContext;
  readonly command: AgentCommand;
  readonly requestId: AutoRequestId;
  readonly isReplay: boolean;
};

const receiptOutcome = async ({
  ctx,
  command,
  requestId,
  isReplay,
}: ReceiptOutcomeParams): Promise<BridgeOutcome> => {
  await ctx.ports.refreshSessionArtifacts({ sessionId: command.grant.sessionId });
  const receipt = await delegationReceipt({
    db: ctx.db,
    treeId: command.grant.treeId,
    requestId,
  });
  return {
    isOk: true,
    data: {
      accepted: true,
      replayed: isReplay,
      ...receipt,
      next: 'End your turn now. The agents start when it is over, and their results come back to you as a message.',
    },
  };
};

type RefusedAdmitParams = {
  readonly outcome: Extract<AdmitOutcome, { kind: 'refused' }>;
};

const refusedAdmit = ({ outcome }: RefusedAdmitParams): BridgeOutcome =>
  refuseOutcome({
    code: outcome.code,
    perChild: outcome.perChild.map((entry) => ({
      slot: entry.slot,
      code: entry.code,
      latestRevision: entry.latestRevision,
    })),
  });

type RecoveredOutcomeParams = {
  readonly recoveries: ReadonlyArray<RecoveredRevise>;
  readonly hasOthers: boolean;
};

const recoveredOutcome = ({ recoveries, hasOthers }: RecoveredOutcomeParams): BridgeOutcome => {
  const lines = recoveries.map(
    (recovery) =>
      `${recovery.delegationId} already landed version ${recovery.revision} of artifact ${recovery.artifactId}`,
  );
  if (hasOthers) {
    return refuseOutcome({
      code: 'retry_unavailable',
      message: `${lines.join('; ')}. Nothing was started: send the other children again without that retry.`,
    });
  }
  return {
    isOk: true,
    data: {
      accepted: false,
      recovered: recoveries,
      next: 'The earlier revise was not lost: its version is saved. Read it with agent status --artifact, and nothing was started again.',
    },
  };
};

export const delegate = async ({
  ctx,
  command,
  isProposal = false,
}: DelegateParams): Promise<BridgeOutcome> => {
  const { grant, args } = command;
  const requestIdText = textOf({ value: args['request-id'] });
  const specText = textOf({ value: args['spec'] });
  if (requestIdText === null || specText === null) {
    return refuseOutcome({
      code: 'spec_invalid',
      message: 'delegate needs --request-id and --spec',
    });
  }
  const requestId = brandId<AutoRequestId>({ value: requestIdText });
  const isOwner = await ctx.scheduler.claim({ treeId: grant.treeId });
  if (!isOwner) {
    return refuseOutcome({ code: 'not_owner' });
  }
  const parsed = isProposal
    ? parseProposeSpec({ text: specText })
    : parseDelegateSpec({ text: specText });
  if (parsed.kind === 'refused') {
    return countedRefusal({
      ctx,
      command,
      outcome: refuseOutcome({
        code: parsed.code,
        message: parsed.message,
        perChild: parsed.perChild,
      }),
    });
  }
  const replay = await replayAdmission({
    db: ctx.db,
    treeId: grant.treeId,
    requestId,
    requestHash: parsed.hash,
  });
  if (replay !== null && replay.kind === 'replayed') {
    return receiptOutcome({ ctx, command, requestId, isReplay: true });
  }
  if (replay !== null && replay.kind === 'refused') {
    return refuseOutcome({ code: replay.code });
  }
  const tree = await getAutoTree({ db: ctx.db, treeId: grant.treeId });
  if (tree === null) {
    return refuseOutcome({ code: 'not_owner' });
  }
  const mounts = await ctx.ports.loadMounts({ sessionId: grant.sessionId });
  const inputs: AdmitChildInput[] = [];
  const refusals = [];
  const recoveries: RecoveredRevise[] = [];
  for (const [slot, child] of parsed.children.entries()) {
    const prepared = child.retryOf === null ? null : await prepareRetry({ ctx, tree, child, slot });
    if (prepared !== null && prepared.kind === 'refused') {
      refusals.push(prepared.refusal);
      continue;
    }
    if (prepared !== null && prepared.kind === 'recovered') {
      recoveries.push(prepared.recovery);
      continue;
    }
    const resolved = await resolveDelegateChild({
      ctx,
      grant,
      tree,
      child: prepared === null ? child : prepared.child,
      slot,
      mounts,
      retry: prepared === null ? null : prepared.original,
    });
    if (resolved.kind === 'ok') {
      inputs.push({
        ...resolved.input,
        request: {
          ...resolved.input.request,
          ...('alternatives' in parsed && { alternatives: parsed.alternatives }),
        },
      });
      continue;
    }
    refusals.push(resolved.refusal);
  }
  const firstRefusal = refusals[0];
  if (firstRefusal !== undefined) {
    return countedRefusal({
      ctx,
      command,
      outcome: refuseOutcome({
        code: firstRefusal.code,
        message: firstRefusal.message,
        perChild: refusals,
      }),
    });
  }
  if (recoveries.length > 0) {
    return recoveredOutcome({ recoveries, hasOthers: inputs.length > 0 });
  }
  const outcome = await ctx.scheduler.admit({
    treeId: grant.treeId,
    callerAgentId: grant.agentId,
    generation: grant.generation,
    runId: grant.runId,
    requestId,
    requestHash: parsed.hash,
    batchId: brandId<AutoBatchId>({ value: ctx.ports.newId() }),
    children: inputs,
    isPlanApprovalRequired: ctx.ports.isPlanApprovalRequired(),
  });
  if (outcome.kind === 'refused') {
    return refusedAdmit({ outcome });
  }
  return receiptOutcome({ ctx, command, requestId, isReplay: outcome.kind === 'replayed' });
};
