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
  readonly messageId: string;
};

const isMessageSaved = async ({ ctx, delegation, messageId }: SavedParams): Promise<boolean> => {
  const queued = await listAgentQueuedMessages(ctx.db, [delegation.childAgentId]);
  if (queued.some((row) => row.id === messageId)) {
    return true;
  }
  const rows = await listAutoDelegations({ db: ctx.db, treeId: delegation.treeId });
  return rows.some(
    (row) => delegationDeliveryIdOf({ delegation: row }) === `${QUEUE_DELIVERY_PREFIX}${messageId}`,
  );
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
  const messageId = `${AUTO_MESSAGE_QUEUE_PREFIX}${delegation.id}:${grant.runId}`;
  const sent = await autoMessageCountOf({ ctx, delegation });
  if (await isMessageSaved({ ctx, delegation, messageId })) {
    return {
      isOk: true,
      data: {
        queued: true,
        replayed: true,
        delegationId: delegation.id,
        messageId,
        sent,
        next: NEXT,
      },
    };
  }
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
