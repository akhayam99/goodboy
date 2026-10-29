import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  casAutoDelegationStateStatement,
  getAutoDelegation,
  releaseAutoReservationStatement,
  settleAutoDelegationStatement,
  type Statement,
} from '@goodboy/db';
import type { ArtifactId, AutoDelegationId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import type { AgentVerbContext } from './verbContext';

export type ConfirmDelegationParams = Readonly<{
  ctx: AgentVerbContext;
  delegationId: AutoDelegationId;
  decision: 'confirm' | 'decline';
  hint?: string;
}>;

export type ConfirmDelegationOutcome = 'confirmed' | 'declined' | 'lost';

const ABORT_TREE = 'confirm_tree';
const ABORT_STATE = 'confirm_state';

export const confirmDelegation = async ({
  ctx,
  delegationId,
  decision,
  hint,
}: ConfirmDelegationParams): Promise<ConfirmDelegationOutcome> => {
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId });
  if (delegation === null || delegation.state !== 'awaiting_confirm') {
    return 'lost';
  }
  const nowMs = ctx.now();
  const guard: Statement = {
    sql: `SELECT 1 FROM auto_trees
      WHERE id = ? AND generation = ? AND stop_state = 'none' AND ${AUTO_OWNER_GUARD_SQL}`,
    params: [
      delegation.treeId,
      delegation.generation,
      ...autoOwnerGuardParams({ ownerId: ctx.scheduler.ownerId, nowMs }),
    ],
    abortWhen: 'noRows',
    abortCode: ABORT_TREE,
  };
  if (decision === 'confirm') {
    const userHint = hint?.trim() ?? '';
    const request = delegation.request;
    const task = typeof request['task'] === 'string' ? request['task'] : '';
    const kickoff = typeof request['kickoff'] === 'string' ? request['kickoff'] : '';
    const hintNote = `\n\nUSER HINT\n${userHint}`;
    const outcome = await ctx.db.transaction({
      statements: [
        guard,
        ...(userHint === ''
          ? []
          : [
              {
                sql: `UPDATE auto_delegations SET request_json = ?
                WHERE id = ? AND generation = ? AND state = 'awaiting_confirm'`,
                params: [
                  JSON.stringify({
                    ...request,
                    hint: userHint,
                    task: task + hintNote,
                    kickoff: kickoff + hintNote,
                  }),
                  delegationId,
                  delegation.generation,
                ],
              },
            ]),
        casAutoDelegationStateStatement({
          delegationId,
          generation: delegation.generation,
          from: ['awaiting_confirm'],
          to: 'accepted',
          abortCode: ABORT_STATE,
        }),
        {
          sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
          params: [nowMs, delegation.treeId],
        },
      ],
    });
    return outcome.status === 'committed' ? 'confirmed' : 'lost';
  }
  const artifactId = delegation.reviseOf;
  const outcome = await ctx.db.transaction({
    statements: [
      guard,
      {
        sql: `SELECT 1 FROM auto_delegations
          WHERE id = ? AND generation = ? AND state = 'awaiting_confirm'`,
        params: [delegationId, delegation.generation],
        abortWhen: 'noRows',
        abortCode: ABORT_STATE,
      },
      settleAutoDelegationStatement({
        delegationId,
        generation: delegation.generation,
        outcome: 'stopped',
        reason: 'declined',
        result: { outcome: 'stopped', reason: 'declined', delegationId },
        nowMs,
        abortCode: ABORT_STATE,
      }),
      releaseAutoReservationStatement({
        treeId: delegation.treeId,
        ownerKind: 'attempt',
        ownerId: delegation.firstAttemptId,
        reason: 'declined',
        nowMs,
      }),
      ...(artifactId === null
        ? []
        : [
            {
              sql: `UPDATE auto_artifacts
                SET approval_state = 'needs_approval', open_revise_delegation_id = NULL, rev = rev + 1
                WHERE artifact_id = ? AND open_revise_delegation_id = ?`,
              params: [brandId<ArtifactId>({ value: artifactId }), delegationId],
            },
          ]),
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, delegation.treeId],
      },
    ],
  });
  return outcome.status === 'committed' ? 'declined' : 'lost';
};
