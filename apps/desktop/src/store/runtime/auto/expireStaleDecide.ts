import { AUTO_STALE_DECIDE_MS, AUTO_STALE_DECIDE_TEXT } from '@goodboy/core';
import {
  autoTreePhaseStatement,
  getAutoTree,
  listAutoOutbox,
  reconcileAutoReservationStatement,
  releaseAutoOutboxClaimsStatement,
  releaseAutoReservationStatement,
  type AutoTree,
  type Statement,
} from '@goodboy/db';
import type { RunOutcome } from './ports';
import { requeueStatements } from './requeueStatements';
import { settleAutoTurn } from './settleAutoTurn';
import type { AgentVerbContext } from './verbContext';

export type ExpireStaleDecideParams = Readonly<{
  ctx: AgentVerbContext;
  treeId: AutoTree['id'];
}>;

const ABORT_PHASE = 'stale_decide_phase';

type BlockParams = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly outcome: RunOutcome | null;
};

const settleTurnCost = async ({ ctx, tree, outcome }: BlockParams): Promise<void> => {
  const deliveryId = tree.activeDeliveryId;
  if (deliveryId === null) {
    return;
  }
  const statement =
    tree.activeRunId === null
      ? releaseAutoReservationStatement({
          treeId: tree.id,
          ownerKind: 'auto_turn',
          ownerId: deliveryId,
          reason: 'decide_stale',
          nowMs: ctx.now(),
        })
      : reconcileAutoReservationStatement({
          treeId: tree.id,
          ownerKind: 'auto_turn',
          ownerId: deliveryId,
          costUsd: outcome?.costUsd ?? null,
          nowMs: ctx.now(),
          abortCode: 'stale_decide_reservation',
        });
  await ctx.db.transaction({ statements: [statement] });
};

const blockStaleTree = async ({ ctx, tree, outcome }: BlockParams): Promise<boolean> => {
  await settleTurnCost({ ctx, tree, outcome });
  const rows = (await listAutoOutbox({ db: ctx.db, treeId: tree.id })).filter(
    (row) => row.generation === tree.generation,
  );
  const accepted = rows.filter(
    (row) =>
      row.state === 'accepted' &&
      tree.activeRunId !== null &&
      row.acceptedRunId === tree.activeRunId,
  );
  const claimed = rows.filter((row) => row.state === 'claimed' && row.claimedBy !== null);
  const statements: Statement[] = [
    autoTreePhaseStatement({
      treeId: tree.id,
      ownerId: ctx.scheduler.ownerId,
      nowMs: ctx.now(),
      expect: { phaseRev: tree.phaseRev, generation: tree.generation, from: ['deciding'] },
      to: 'blocked',
      patch: {
        blockedReason: AUTO_STALE_DECIDE_TEXT,
        activeRunId: null,
        activeDeliveryId: null,
        isYieldRequested: false,
      },
      abortCode: ABORT_PHASE,
    }),
    ...requeueStatements({ ctx, tree, rows: accepted }),
    ...claimed.map((row) =>
      releaseAutoOutboxClaimsStatement({ outboxIds: [row.id], claimedBy: row.claimedBy ?? '' }),
    ),
  ];
  const result = await ctx.db.transaction({ statements });
  return result.status === 'committed';
};

export const expireStaleDecide = async ({
  ctx,
  treeId,
}: ExpireStaleDecideParams): Promise<boolean> => {
  const isOwner = await ctx.scheduler.claim({ treeId });
  const tree = isOwner ? await getAutoTree({ db: ctx.db, treeId }) : null;
  if (tree === null || tree.phase !== 'deciding' || tree.stopState !== 'none') {
    return false;
  }
  if (ctx.now() - tree.updatedAt < AUTO_STALE_DECIDE_MS) {
    return false;
  }
  const runId = tree.activeRunId;
  if (runId !== null && (await ctx.ports.isRunLive({ runId }))) {
    return false;
  }
  const outcome =
    runId === null
      ? null
      : await ctx.ports.readRunOutcome({
          runId,
          agentId: tree.rootAgentId,
          sessionId: tree.sessionId,
        });
  if (runId !== null && outcome !== null && outcome.assistantText.trim() !== '') {
    const settled = await settleAutoTurn({
      ctx,
      ended: {
        treeId: tree.id,
        generation: tree.generation,
        runId,
        deliveryId: tree.activeDeliveryId ?? '',
        agentId: tree.rootAgentId,
        assistantText: outcome.assistantText,
        exit: outcome.exit,
        costUsd: outcome.costUsd,
      },
    });
    return settled.kind === 'settled';
  }
  return blockStaleTree({ ctx, tree, outcome });
};
