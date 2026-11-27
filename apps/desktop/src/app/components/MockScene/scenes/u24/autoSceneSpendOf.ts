import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TelemetryRecord,
  type TelemetryRecordId,
} from '@goodboy/types';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';

const SPEND_RUN_ID = brandId<ProviderRunId>({ value: 'mock-auto-lead-spend-run' });
const SPEND_RECORD_ID = brandId<TelemetryRecordId>({ value: 'mock-auto-lead-spend' });

type Params = {
  readonly sessionId: SessionId;
  readonly leadId: AgentId;
  readonly view: AutoTreeView;
  readonly recordedAt: IsoDateTime;
};

export const autoSceneSpendOf = ({ sessionId, leadId, view, recordedAt }: Params) => {
  const record: TelemetryRecord = {
    id: SPEND_RECORD_ID,
    runId: SPEND_RUN_ID,
    sessionId,
    kind: 'turn',
    provider: 'anthropic',
    model: 'opus-5.5',
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: view.budget?.spentUsd ?? 0,
    recordedAt,
  };
  return {
    sessionTelemetry: { [sessionId]: [record] },
    agentRunHistory: { [leadId]: [SPEND_RUN_ID] },
  };
};
