import { AUTO_CLOSE_AS, type AutoCloseAs } from '@goodboy/core/auto';
import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  getAutoArtifact,
  getAutoDelegation,
  getAutoTree,
  listGoneAutoChildIds,
  readAutoArtifactLiveState,
  type AutoDelegation,
} from '@goodboy/db';
import { brandId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import { textOf } from '@goodboy/types/helpers';
import { delegationClosedOf } from '../../../../features/auto/delegationClosedOf';
import { readLeadPermissions } from '../level/readLeadPermissions';
import type { AgentCommand, BridgeOutcome } from '../ports';
import { refuseOutcome } from '../refuseOutcome';
import { stopChild } from '../talk/stopChild';
import type { AgentVerbContext } from '../verbContext';
import { discardAutoPlan } from './discardAutoPlan';

export type CloseTargetParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

const WORKING_STATES: ReadonlyArray<string> = ['starting', 'running'];

const ABORT_TREE = 'close_tree';

const NOT_STARTED =
  'That agent has not started or waits for an answer, so it was not closed. Answer it, or close it once it runs or ends.';

type DelegationParams = {
  readonly ctx: AgentVerbContext;
  readonly command: AgentCommand;
  readonly delegation: AutoDelegation;
  readonly as: AutoCloseAs;
  readonly reason: string;
};

const closeDelegation = async ({
  ctx,
  command,
  delegation,
  as,
  reason,
}: DelegationParams): Promise<BridgeOutcome> => {
  const { grant } = command;
  const existing = delegationClosedOf({ delegation });
  if (existing !== null && existing.as === as) {
    return { isOk: true, data: { closed: delegation.id, as, isNoop: true } };
  }
  const gone = await listGoneAutoChildIds({
    db: ctx.db,
    treeId: grant.treeId,
    sessionId: grant.sessionId,
  });
  if (gone.includes(delegation.childAgentId)) {
    return { isOk: true, data: { closed: delegation.id, as, isNoop: true, isGone: true } };
  }
  if (delegation.state !== 'settled' && !WORKING_STATES.includes(delegation.state)) {
    return refuseOutcome({ code: 'not_running', message: NOT_STARTED });
  }
  if (WORKING_STATES.includes(delegation.state)) {
    const stopped = await stopChild({
      ctx,
      command: { verb: 'stop', args: { delegation: delegation.id, reason }, grant },
    });
    if (!stopped.isOk) {
      return stopped;
    }
  }
  const nowMs = ctx.now();
  const outcome = await ctx.db.transaction({
    statements: [
      {
        sql: `SELECT 1 FROM auto_trees
          WHERE id = ? AND generation = ? AND stop_state = 'none' AND ${AUTO_OWNER_GUARD_SQL}`,
        params: [
          grant.treeId,
          grant.generation,
          ...autoOwnerGuardParams({ ownerId: ctx.scheduler.ownerId, nowMs }),
        ],
        abortWhen: 'noRows',
        abortCode: ABORT_TREE,
      },
      {
        sql: `UPDATE auto_delegations
          SET request_json = json_set(request_json, '$.closed', json(?))
          WHERE id = ? AND tree_id = ?`,
        params: [
          JSON.stringify({ as, reason, at: nowMs, by: 'lead', runId: grant.runId }),
          delegation.id,
          grant.treeId,
        ],
      },
      {
        sql: 'UPDATE agents SET done_at = COALESCE(done_at, ?) WHERE id = ?',
        params: [nowMs, delegation.childAgentId],
      },
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, grant.treeId],
      },
    ],
  });
  if (outcome.status === 'aborted') {
    return refuseOutcome({ code: 'generation_changed' });
  }
  return { isOk: true, data: { closed: delegation.id, as, reason } };
};

type ArtifactParams = {
  readonly ctx: AgentVerbContext;
  readonly command: AgentCommand;
  readonly artifactId: ArtifactId;
  readonly as: AutoCloseAs;
  readonly reason: string;
};

const closeArtifact = async ({
  ctx,
  command,
  artifactId,
  as,
  reason,
}: ArtifactParams): Promise<BridgeOutcome> => {
  const { grant } = command;
  if (as !== 'discarded') {
    return refuseOutcome({
      code: 'spec_invalid',
      message: `an artifact can only be discarded: send "as":"discarded" for ${artifactId}`,
    });
  }
  const registered = await getAutoArtifact({ db: ctx.db, artifactId });
  const live = await readAutoArtifactLiveState({ db: ctx.db, artifactId });
  if (registered === null || live === null || registered.treeId !== grant.treeId) {
    return refuseOutcome({ code: 'artifact_unknown' });
  }
  const permissions = await readLeadPermissions({ db: ctx.db, target: { treeId: grant.treeId } });
  const isWaitingForUser =
    registered.kind === 'plan' &&
    live.status === 'active' &&
    registered.approvalState === 'needs_approval' &&
    registered.openReviseDelegationId === null;
  if (isWaitingForUser && permissions.rows.approvePlan.value === 'ask') {
    const nowMs = ctx.now();
    await ctx.db.execute(
      `UPDATE auto_delegations SET request_json = json_set(request_json, '$.planDiscardAsk', json(?))
        WHERE id = ? AND tree_id = ?`,
      [
        JSON.stringify({ artifactId, revision: live.revision, reason, at: nowMs }),
        registered.ownerDelegationId,
        grant.treeId,
      ],
    );
    await ctx.db.execute(
      'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
      [nowMs, grant.treeId],
    );
    return {
      isOk: true,
      data: {
        asked: artifactId,
        next: 'The user approves plans, so Goodboy asked them to drop it. It stays until they do.',
      },
    };
  }
  const outcome = await discardAutoPlan({
    db: ctx.db,
    treeId: grant.treeId,
    artifactId,
    nowMs: ctx.now(),
  });
  switch (outcome) {
    case 'discarded':
      return { isOk: true, data: { discarded: artifactId, reason } };
    case 'already_discarded':
      return { isOk: true, data: { discarded: artifactId, isNoop: true } };
    case 'unknown':
      return refuseOutcome({ code: 'artifact_unknown' });
    case 'consumed':
      return refuseOutcome({ code: 'artifact_consumed' });
    case 'revising':
      return refuseOutcome({ code: 'artifact_revising' });
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
};

export const closeTarget = async ({ ctx, command }: CloseTargetParams): Promise<BridgeOutcome> => {
  const { grant, args } = command;
  const target = textOf({ value: args['target'] });
  const reason = textOf({ value: args['reason'] });
  const as = AUTO_CLOSE_AS.find((candidate) => candidate === args['as']);
  if (target === null || reason === null || as === undefined) {
    return refuseOutcome({
      code: 'spec_invalid',
      message: 'a close needs a target, an "as" of done, skipped or discarded, and a reason',
    });
  }
  const isOwner = await ctx.scheduler.claim({ treeId: grant.treeId });
  if (!isOwner) {
    return refuseOutcome({ code: 'not_owner' });
  }
  const tree = await getAutoTree({ db: ctx.db, treeId: grant.treeId });
  if (tree === null || tree.stopState !== 'none') {
    return refuseOutcome({ code: 'tree_stopped' });
  }
  const delegation = await getAutoDelegation({
    db: ctx.db,
    delegationId: brandId<AutoDelegationId>({ value: target }),
  });
  if (delegation !== null && delegation.treeId === grant.treeId) {
    return closeDelegation({ ctx, command, delegation, as, reason });
  }
  const artifactId = brandId<ArtifactId>({ value: target });
  if ((await getAutoArtifact({ db: ctx.db, artifactId })) !== null) {
    return closeArtifact({ ctx, command, artifactId, as, reason });
  }
  return refuseOutcome({
    code: 'delegation_unknown',
    message: `${target} is no agent and no artifact of this conversation. Use a delegation id or an artifact id from the state above.`,
  });
};
