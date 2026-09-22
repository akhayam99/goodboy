import { planContextRead } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  invokeEvidenceDeliveryRecord,
  type EvidenceDeliveryEntry,
} from '../../../features/workflows/workflows';
import { issuedAgentInventory } from './agentEvidenceInventory';
import type { GetFn, SetFn } from './types';

const RANGE_RE = /^(\d+)-(\d+)$/;

export type EvidenceSourceRequest = Readonly<{
  id: string;
  range: string | null;
}>;

export type EvidenceDeliveryOutcome =
  | Readonly<{ kind: 'refused'; reason: string }>
  | Readonly<{
      kind: 'delivered';
      inventoryRevision: string;
      receipts: ReadonlyArray<EvidenceDeliveryEntry>;
      deliveredCount: number;
      refusedCount: number;
    }>;

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly sourceTurnId: string;
  readonly inventoryRevision: string | null;
  readonly sources: ReadonlyArray<EvidenceSourceRequest>;
  readonly heading: string;
};

const sliceByRange = ({
  content,
  range,
}: {
  readonly content: string;
  readonly range: string | null;
}): string => {
  if (range === null) {
    return content;
  }
  const match = RANGE_RE.exec(range);
  if (match === null) {
    return content;
  }
  const lines = content.split('\n');
  const from = Math.max(1, Number(match[1]));
  const to = Math.min(lines.length, Number(match[2]));
  return lines.slice(from - 1, to).join('\n');
};

export const undeliveredReason = ({
  receipts,
}: {
  readonly receipts: ReadonlyArray<EvidenceDeliveryEntry>;
}): string =>
  receipts
    .filter((receipt) => receipt.outcome !== 'delivered')
    .map((receipt) => `${receipt.sourceId}: ${receipt.reason}`)
    .join('; ');

export const deliverEvidenceSources = async ({
  set,
  get,
  sessionId,
  agentId,
  sourceTurnId,
  inventoryRevision,
  sources,
  heading,
}: Params): Promise<EvidenceDeliveryOutcome> => {
  const { inventory, contents } = issuedAgentInventory({ get, sessionId, agentId });
  const plan = planContextRead({
    inventory,
    request: {
      version: 1,
      inventoryRevision: inventoryRevision ?? inventory.revision,
      sources,
    },
    authorizedSourceIds: new Set(contents.keys()),
  });
  if (plan.kind !== 'resolved') {
    return {
      kind: 'refused',
      reason: plan.kind === 'none' ? 'the request names no source' : plan.reason,
    };
  }

  const receipts: EvidenceDeliveryEntry[] = [];
  const blocks: string[] = [];
  for (const resolution of plan.resolutions) {
    if (resolution.outcome !== 'delivered') {
      receipts.push({
        sourceId: resolution.sourceId,
        requestedRange: resolution.range,
        outcome: resolution.outcome,
        deliveredChars: 0,
        reason: resolution.reason,
      });
      blocks.push(`### ${resolution.sourceId}\nnot supplied: ${resolution.reason}`);
      continue;
    }
    const body = sliceByRange({
      content: contents.get(resolution.sourceId) ?? '',
      range: resolution.range,
    });
    receipts.push({
      sourceId: resolution.sourceId,
      requestedRange: resolution.range,
      outcome: 'delivered',
      deliveredChars: body.length,
      reason: '',
    });
    blocks.push(`### ${resolution.sourceId}\n${body}`);
  }

  try {
    await invokeEvidenceDeliveryRecord({
      sessionId,
      agentId,
      sourceTurnId,
      inventoryRevision: inventory.revision,
      receipts,
    });
  } catch {
    return { kind: 'refused', reason: 'the delivery receipt could not be recorded' };
  }

  set((state) => ({
    agentTurnState: {
      ...state.agentTurnState,
      [agentId]: { kind: 'idle' as const, lastActivityAt: new Date().toISOString() },
    },
  }));
  void get().sendTurn({
    sessionId,
    agentId,
    content: [heading, ...blocks, 'carry on with your assignment from here.'].join('\n\n'),
    origin: 'workflow',
  });

  const deliveredCount = receipts.filter((receipt) => receipt.outcome === 'delivered').length;
  return {
    kind: 'delivered',
    inventoryRevision: inventory.revision,
    receipts,
    deliveredCount,
    refusedCount: receipts.length - deliveredCount,
  };
};
