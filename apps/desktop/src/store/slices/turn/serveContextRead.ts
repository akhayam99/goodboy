import { extractContextRead, planContextRead } from '@goodboy/core';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import {
  invokeEvidenceDeliveryRecord,
  type EvidenceDeliveryEntry,
} from '../../../features/workflows/workflows';
import { issuedAgentInventory } from './agentEvidenceInventory';
import type { GetFn, SetFn } from './types';

const RANGE_RE = /^(\d+)-(\d+)$/;

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly assistantText: string;
};

export type ContextReadService =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'refused'; reason: string }>
  | Readonly<{ kind: 'held'; reason: string }>
  | Readonly<{ kind: 'served'; delivered: number; refused: number }>;

export const contextReadBlocksCompletion = ({
  service,
}: {
  readonly service: ContextReadService;
}): boolean => service.kind === 'served' || service.kind === 'held';

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

export const serveContextRead = async ({
  set,
  get,
  sessionId,
  agentId,
  runId,
  assistantText,
}: Params): Promise<ContextReadService> => {
  const extraction = extractContextRead({ assistantText });
  if (extraction.kind === 'none') {
    return { kind: 'none' };
  }
  const agent = (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
  if (agent === undefined) {
    return { kind: 'none' };
  }
  if (extraction.kind === 'malformed') {
    void get().emitNotification(
      'error',
      'warning',
      `context read refused: ${agent.name}`,
      extraction.reason,
      { sessionId },
    );
    return { kind: 'refused', reason: extraction.reason };
  }
  const { inventory, contents } = issuedAgentInventory({ get, sessionId, agentId });
  const plan = planContextRead({
    inventory,
    request: extraction.request,
    authorizedSourceIds: new Set(contents.keys()),
  });
  if (plan.kind === 'stale-revision' || plan.kind === 'empty') {
    void get().emitNotification(
      'error',
      'warning',
      `context read refused: ${agent.name}`,
      plan.reason,
      { sessionId },
    );
    return { kind: 'refused', reason: plan.reason };
  }
  if (plan.kind === 'none') {
    return { kind: 'none' };
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
      sourceTurnId: runId,
      inventoryRevision: inventory.revision,
      receipts,
    });
  } catch {
    const reason =
      'the delivery receipt could not be recorded, so nothing was handed over and the agent is held until it asks again';
    void get().emitNotification('error', 'warning', `context read held: ${agent.name}`, reason, {
      sessionId,
    });
    return { kind: 'held', reason };
  }

  const delivered = receipts.filter((receipt) => receipt.outcome === 'delivered').length;
  set((state) => ({
    agentTurnState: {
      ...state.agentTurnState,
      [agentId]: { kind: 'idle' as const, lastActivityAt: new Date().toISOString() },
    },
  }));
  void get().sendTurn({
    sessionId,
    agentId,
    content: [
      '## requested sources (retrieved by the host, no agent was created)',
      ...blocks,
      'carry on with your assignment from here.',
    ].join('\n\n'),
    origin: 'workflow',
  });
  return { kind: 'served', delivered, refused: receipts.length - delivered };
};
