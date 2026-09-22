import { extractContextRead } from '@goodboy/core';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import { deliverEvidenceSources } from './deliverEvidenceSources';
import type { GetFn, SetFn } from './types';

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
  | Readonly<{ kind: 'served'; delivered: number; refused: number }>;

export const contextReadBlocksCompletion = ({
  service,
}: {
  readonly service: ContextReadService;
}): boolean => service.kind === 'served';

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

  const delivery = await deliverEvidenceSources({
    set,
    get,
    sessionId,
    agentId,
    sourceTurnId: runId,
    inventoryRevision: extraction.request.inventoryRevision,
    sources: extraction.request.sources,
    heading: '## requested sources (retrieved by the host, no agent was created)',
  });
  if (delivery.kind === 'refused') {
    void get().emitNotification(
      'error',
      'warning',
      `context read refused: ${agent.name}`,
      delivery.reason,
      { sessionId },
    );
    return { kind: 'refused', reason: delivery.reason };
  }
  return { kind: 'served', delivered: delivery.deliveredCount, refused: delivery.refusedCount };
};
