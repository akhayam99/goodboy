import { getAutoDelegation, getAutoTree, listAutoAttemptsOfDelegation } from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { textOf } from '@goodboy/types/helpers';
import { failAttempt } from '../failAttempt';
import type { AgentCommand, BridgeOutcome } from '../ports';
import { refuseOutcome } from '../refuseOutcome';
import type { AgentVerbContext } from '../verbContext';
import { stoppedPhraseOf } from '../../../../features/live-state/stoppedPhraseOf';

export type StopChildParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

const WORKING_STATES: ReadonlyArray<string> = ['starting', 'running'];

const ALREADY_ENDED =
  'That agent had already ended, so nothing was stopped. Its result is in your messages.';

export const stopChild = async ({ ctx, command }: StopChildParams): Promise<BridgeOutcome> => {
  const { grant, args } = command;
  const delegationText = textOf({ value: args['delegation'] });
  const reason = textOf({ value: args['reason'] });
  if (delegationText === null || reason === null) {
    return refuseOutcome({
      code: 'spec_invalid',
      message: 'a stop needs a delegation and a reason',
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
  if (delegation.state === 'settled') {
    return {
      isOk: true,
      data: {
        stopped: false,
        alreadyEnded: true,
        outcome: delegation.outcome,
        next: ALREADY_ENDED,
      },
    };
  }
  if (delegation.generation !== grant.generation) {
    return refuseOutcome({ code: 'generation_changed' });
  }
  if (!WORKING_STATES.includes(delegation.state)) {
    return refuseOutcome({ code: 'not_running' });
  }
  const tree = await getAutoTree({ db: ctx.db, treeId: grant.treeId });
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId });
  const attempt = attempts[attempts.length - 1];
  if (tree === null || attempt === undefined) {
    return refuseOutcome({ code: 'not_running' });
  }
  const sentence = stoppedPhraseOf({ by: 'auto', reason });
  const cancelled = await ctx.ports.cancelRun({
    sessionId: tree.sessionId,
    agentId: delegation.childAgentId,
    by: 'auto',
  });
  if (cancelled.outcome !== 'exited') {
    await ctx.db.execute(
      `UPDATE auto_delegations SET is_stopping = 1, reason = ? WHERE id = ? AND state <> 'settled'`,
      [sentence, delegation.id],
    );
    return {
      isOk: true,
      data: {
        stopped: false,
        stopping: true,
        delegationId: delegation.id,
        next: 'The agent is stopping. Its work stays in its worktree.',
      },
    };
  }
  const settled = await failAttempt({
    ctx,
    delegation,
    attempt,
    generation: delegation.generation,
    reason: sentence,
    outcome: 'stopped',
    costUsd: null,
  });
  return {
    isOk: true,
    data: {
      stopped: settled.kind === 'settled',
      delegationId: delegation.id,
      next: 'The agent stopped. Its work stays in its worktree: continue it later with "retryOf" and a "task".',
    },
  };
};
