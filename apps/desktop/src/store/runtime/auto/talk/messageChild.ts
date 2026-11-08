import { AUTO_CHILD_MESSAGE_CHARS, AUTO_TREE_LIMITS } from '@goodboy/core/auto';
import {
  getAutoDelegation,
  listAgentQueuedMessages,
  listAutoDelegations,
  type AutoDelegation,
} from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { textOf } from '@goodboy/types/helpers';
import { AUTO_MESSAGE_QUEUE_PREFIX } from '../../../../features/auto/AUTO_MESSAGE_QUEUE_PREFIX';
import { delegationContinueOf } from '../../../../features/auto/delegationContinueOf';
import type { AgentCommand, BridgeOutcome } from '../ports';
import { refuseOutcome } from '../refuseOutcome';
import type { AgentVerbContext } from '../verbContext';
import { autoMessageCountOf } from './autoMessageCountOf';
import { delegationDeliveryIdOf } from './delegationDeliveryIdOf';
import { QUEUE_DELIVERY_PREFIX } from '../../../slices/agentQueue/QUEUE_DELIVERY_PREFIX';

export type MessageChildParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

const WORKING_STATES: ReadonlyArray<string> = ['starting', 'running'];

const NEXT =
  'The agent reads it as its next turn when its current turn ends. Its answer comes back to you as a result.';

type SavedParams = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly runPrefix: string;
};

const savedMessagesOf = async ({
  ctx,
  delegation,
  runPrefix,
}: SavedParams): Promise<ReadonlyMap<string, string>> => {
  const saved = new Map<string, string>();
  const queued = await listAgentQueuedMessages(ctx.db, [delegation.childAgentId]);
  for (const row of queued) {
    if (row.id.startsWith(runPrefix)) {
      saved.set(row.id, row.content);
    }
  }
  const rows = await listAutoDelegations({ db: ctx.db, treeId: delegation.treeId });
  for (const row of rows) {
    const deliveryId = delegationDeliveryIdOf({ delegation: row });
    const given = delegationContinueOf({ delegation: row });
    if (deliveryId?.startsWith(`${QUEUE_DELIVERY_PREFIX}${runPrefix}`) === true && given !== null) {
      saved.set(deliveryId.slice(QUEUE_DELIVERY_PREFIX.length), given.text);
    }
  }
  return saved;
};

type NextIndexParams = {
  readonly saved: ReadonlyMap<string, string>;
  readonly runPrefix: string;
};

const nextIndexOf = ({ saved, runPrefix }: NextIndexParams): number => {
  let next = 0;
  for (const id of saved.keys()) {
    const used = Number(id.slice(runPrefix.length));
    if (Number.isInteger(used) && used >= next) {
      next = used + 1;
    }
  }
  return next;
};

export const messageChild = async ({
  ctx,
  command,
}: MessageChildParams): Promise<BridgeOutcome> => {
  const { grant, args } = command;
  const delegationText = textOf({ value: args['delegation'] });
  const text = textOf({ value: args['text'] });
  if (delegationText === null || text === null || text.length > AUTO_CHILD_MESSAGE_CHARS) {
    return refuseOutcome({
      code: 'spec_invalid',
      message: `a message needs a delegation and a text of at most ${AUTO_CHILD_MESSAGE_CHARS} characters`,
    });
  }
  const isOwner = await ctx.scheduler.claim({ treeId: grant.treeId });
  if (!isOwner) {
    return refuseOutcome({ code: 'not_owner' });
  }
  const delegationId = brandId<AutoDelegationId>({ value: delegationText });
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId });
  if (delegation === null || delegation.treeId !== grant.treeId) {
    return refuseOutcome({ code: 'delegation_unknown' });
  }
  if (delegation.generation !== grant.generation) {
    return refuseOutcome({ code: 'generation_changed' });
  }
  const runPrefix = `${AUTO_MESSAGE_QUEUE_PREFIX}${delegation.id}:${grant.runId}:`;
  const sent = await autoMessageCountOf({ ctx, delegation });
  const saved = await savedMessagesOf({ ctx, delegation, runPrefix });
  const replayedId = [...saved].find(([, savedText]) => savedText === text)?.[0];
  if (replayedId !== undefined) {
    return {
      isOk: true,
      data: {
        queued: true,
        replayed: true,
        delegationId: delegation.id,
        messageId: replayedId,
        sent,
        next: NEXT,
      },
    };
  }
  const messageId = `${runPrefix}${nextIndexOf({ saved, runPrefix })}`;
  if (!WORKING_STATES.includes(delegation.state)) {
    return refuseOutcome({ code: 'not_running' });
  }
  if (sent >= AUTO_TREE_LIMITS.messagesPerDelegation) {
    return refuseOutcome({ code: 'message_limit' });
  }
  const isQueued = await ctx.ports.queueChildMessage({
    sessionId: grant.sessionId,
    agentId: delegation.childAgentId,
    messageId,
    text,
  });
  if (!isQueued) {
    return refuseOutcome({
      code: 'tree_busy',
      message: 'The message could not be saved for that agent. Send it again.',
    });
  }
  return {
    isOk: true,
    data: {
      queued: true,
      delegationId: delegation.id,
      messageId,
      sent: sent + 1,
      next: NEXT,
    },
  };
};
