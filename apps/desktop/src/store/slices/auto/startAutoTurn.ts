import { brandId, type ProviderRunId } from '@goodboy/types';
import { AUTO_CONFINED_ROLE } from '../turn/confinedRoleOf';
import type { StartAutoTurnParams, TurnStartOutcome } from './ports';
import { startDeliveredTurn, type DeliveredTurnDeps } from './startDeliveredTurn';

const AUTO_TURN_ACCEPT_TIMEOUT_MS = 20_000;

export type StartAutoTurnDeps = DeliveredTurnDeps;

export const makeStartAutoTurn =
  (deps: StartAutoTurnDeps) =>
  async (params: StartAutoTurnParams): Promise<TurnStartOutcome> => {
    const outcome = await startDeliveredTurn({
      deps,
      input: {
        sessionId: params.sessionId,
        agentId: params.agentId,
        content: params.text,
        ...(params.images !== undefined &&
          params.images.length > 0 && { storedAttachments: params.images }),
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
