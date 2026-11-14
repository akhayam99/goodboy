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
import { readPlanApprovalGuards } from './admission/readPlanApprovalGuards';
import { writerInputRefsOf } from './admission/writerInputRefsOf';
import { attemptEnvelope } from './attemptEnvelope';
import type { AgentVerbContext } from './verbContext';

export type ConfirmDelegationParams = Readonly<{
  ctx: AgentVerbContext;
  delegationId: AutoDelegationId;
  decision: 'confirm' | 'decline';
  hint?: string;
}>;

export type ConfirmDelegationOutcome = 'confirmed' | 'declined' | 'lost' | 'refused';

const ABORT_TREE = 'confirm_tree';
const ABORT_STATE = 'confirm_state';
const ABORT_PLAN = 'confirm_plan';

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
    const refs = writerInputRefsOf({ delegation });
    const planGuards =
      refs.length === 0
        ? []
        : await readPlanApprovalGuards({
            db: ctx.db,
            treeId: delegation.treeId,
            refs,
            isPlanApprovalRequired: ctx.ports.isPlanApprovalRequired(),
            abortCode: ABORT_PLAN,
          });
    const outcome = await ctx.db.transaction({
      statements: [
        guard,
        ...planGuards,
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
    if (outcome.status === 'aborted' && outcome.abortCode === ABORT_PLAN) {
      return 'refused';
    }
    return outcome.status === 'committed' ? 'confirmed' : 'lost';
  }
  const artifactId = delegation.reviseOf;
  const declined = {
    ...attemptEnvelope({
      delegation,
      attempt: { id: delegation.firstAttemptId },
      generation: delegation.generation,
      exit: 'cancelled',
      closing: null,
      artifactPersistence: 'not_applicable',
      costUsd: null,
      turns: 0,
    }),
    reason: 'declined',
  };
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
        result: declined,
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
