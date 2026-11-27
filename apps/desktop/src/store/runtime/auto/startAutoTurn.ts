import { brandId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { NO_RESOLVED_ASKS } from '../../slices/permissions/noResolvedAsks';
import { AUTO_CONFINED_ROLE } from '../../slices/turn/confinedRoleOf';
import type { StartAutoTurnParams, TurnStartOutcome } from './ports';
import { startDeliveredTurn, type DeliveredTurnDeps } from './startDeliveredTurn';

const AUTO_TURN_ACCEPT_TIMEOUT_MS = 20_000;
const LATE_START_MESSAGE = 'The turn did not start in time.';

export type LoadAgentPicksParams = Readonly<{ sessionId: SessionId }>;

export type StartAutoTurnDeps = DeliveredTurnDeps &
  Readonly<{
    loadAgentPicks: (params: LoadAgentPicksParams) => Promise<void>;
  }>;

export const makeStartAutoTurn =
  (deps: StartAutoTurnDeps) =>
  async (params: StartAutoTurnParams): Promise<TurnStartOutcome> => {
    const startedAt = deps.nowMs();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'late'>((resolve) => {
      deadline = setTimeout(() => resolve('late'), AUTO_TURN_ACCEPT_TIMEOUT_MS);
    });
    const read = await Promise.race([
      deps.loadAgentPicks({ sessionId: params.sessionId }).then(() => 'read' as const),
      late,
    ]).finally(() => {
      clearTimeout(deadline);
    });
    const remainingMs = AUTO_TURN_ACCEPT_TIMEOUT_MS - (deps.nowMs() - startedAt);
    if (read === 'late' || remainingMs <= 0) {
      return { kind: 'refused', message: LATE_START_MESSAGE };
    }
    const outcome = await startDeliveredTurn({
      deps,
      input: {
        sessionId: params.sessionId,
        agentId: params.agentId,
        content: params.text,
        ...(params.images !== undefined &&
          params.images.length > 0 && { storedAttachments: params.images }),
        ...(params.rowIds !== undefined && { outboxIds: params.rowIds }),
        ...(params.permissionOnceAllows !== undefined &&
          params.permissionOnceAllows.length > 0 && {
            permissionOnceAllows: params.permissionOnceAllows,
          }),
        resolvedAsks: NO_RESOLVED_ASKS,
        origin: 'delegation',
        confinedRole: AUTO_CONFINED_ROLE,
      },
      runId: brandId<ProviderRunId>({ value: params.runId }),
      deliveryId: params.deliveryId,
      acceptTimeoutMs: remainingMs,
      onEnded: (ended) => {
        params.onEnded({
          treeId: params.treeId,
          generation: params.generation,
          runId: params.runId,
          deliveryId: params.deliveryId,
          agentId: params.agentId,
          assistantText: ended.assistantText,
          exit: ended.exit,
          costUsd: ended.costUsd,
        });
      },
    });
    if (outcome.kind === 'refused') {
      return { kind: 'refused', message: outcome.message };
    }
    return outcome;
  };
