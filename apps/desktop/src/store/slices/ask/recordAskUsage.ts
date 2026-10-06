import { computeProviderCostUsd } from '@goodboy/core';
import { insertProviderRun, updateProviderRunStatus } from '@goodboy/db';
import type {
  ChatMessageId,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  ProviderUsage,
  SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { recordUsageTelemetry } from '../turn/recordUsageTelemetry';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly messageId: ChatMessageId;
  readonly provider: ProviderId;
  readonly model: string;
  readonly usage: ProviderUsage;
};

const isoNow = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

export const recordAskUsage = async ({
  set,
  get,
  sessionId,
  messageId,
  provider,
  model,
  usage,
}: Params): Promise<void> => {
  if (usage.inputTokens + usage.outputTokens === 0) {
    return;
  }
  const costUsd = computeProviderCostUsd({ providerId: provider, usage, model });
  set((state) => ({
    askReplyMeta: {
      ...state.askReplyMeta,
      [messageId]: { costUsd: (state.askReplyMeta[messageId]?.costUsd ?? 0) + costUsd },
    },
  }));
  const runId = crypto.randomUUID() as ProviderRunId;
  const at = isoNow();
  await insertProviderRun(tauriDatabase, {
    id: runId,
    sessionId,
    provider,
    model,
    status: { kind: 'streaming', startedAt: at },
    createdAt: at,
  });
  await updateProviderRunStatus(tauriDatabase, runId, { kind: 'succeeded', finishedAt: isoNow() });
  await recordUsageTelemetry(set, get, {
    event: { kind: 'usage', runId, usage, at },
    provider,
    model,
    runId,
    sessionId,
    now: isoNow,
    kind: 'ask',
  });
};
