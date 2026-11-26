import { brandId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { NO_RESOLVED_ASKS } from '../../slices/permissions/noResolvedAsks';
import { AUTO_CONFINED_ROLE } from '../../slices/turn/confinedRoleOf';
import type { StartAutoTurnParams, TurnStartOutcome } from './ports';
import { startDeliveredTurn, type DeliveredTurnDeps } from './startDeliveredTurn';

const AUTO_TURN_ACCEPT_TIMEOUT_MS = 20_000;

export type LoadAgentPicksParams = Readonly<{ sessionId: SessionId }>;

export type StartAutoTurnDeps = DeliveredTurnDeps &
  Readonly<{
    loadAgentPicks: (params: LoadAgentPicksParams) => Promise<void>;
  }>;

export const makeStartAutoTurn =
  (deps: StartAutoTurnDeps) =>
  async (params: StartAutoTurnParams): Promise<TurnStartOutcome> => {
    await deps.loadAgentPicks({ sessionId: params.sessionId });
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
      acceptTimeoutMs: AUTO_TURN_ACCEPT_TIMEOUT_MS,
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
