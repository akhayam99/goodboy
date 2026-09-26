import { useMemo } from 'react';
import type {
  AgentId,
  ProviderName,
  ProviderRunId,
  ProviderUsage,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';

export type TurnFooterData = {
  readonly provider: ProviderName | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly contextTokens: number | null;
  readonly estimatedCostUsd: number | null;
};

const EMPTY_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

type Params = {
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly runId: ProviderRunId;
  readonly fallbackUsage: ProviderUsage;
};

export const useTurnFooter = ({
  sessionId,
  agentId,
  runId,
  fallbackUsage,
}: Params): TurnFooterData => {
  const routing = useAppStore((state) =>
    agentId !== null ? (state.runRouting[agentId]?.[runId] ?? null) : null,
  );
  const records = useAppStore((state) =>
    sessionId !== null ? (state.sessionTelemetry[sessionId] ?? EMPTY_TELEMETRY) : EMPTY_TELEMETRY,
  );

  return useMemo(() => {
    const forRun = records.filter((record) => record.runId === runId);
    const last = forRun[forRun.length - 1] ?? null;
    const provider = routing?.provider ?? last?.provider ?? null;
    const model = routing?.model ?? last?.model ?? null;
    const effort = routing?.effort ?? null;

    if (forRun.length === 0) {
      const cost = fallbackUsage.estimatedCostUsd;
      return {
        provider,
        model,
        effort,
        inputTokens: fallbackUsage.inputTokens,
        outputTokens: fallbackUsage.outputTokens,
        cachedInputTokens: fallbackUsage.cachedInputTokens,
        cacheCreationInputTokens: fallbackUsage.cacheCreationInputTokens ?? 0,
        contextTokens: fallbackUsage.contextTokens ?? null,
        estimatedCostUsd: cost > 0 ? cost : null,
      };
    }

    const inputTokens = forRun.reduce((sum, record) => sum + record.inputTokens, 0);
    const outputTokens = forRun.reduce((sum, record) => sum + record.outputTokens, 0);
    const cachedInputTokens = forRun.reduce(
      (sum, record) => sum + (record.cachedInputTokens ?? 0),
      0,
    );
    const cacheCreationInputTokens = forRun.reduce(
      (sum, record) => sum + (record.cacheCreationInputTokens ?? 0),
      0,
    );
    const estimatedCostUsd = forRun.reduce((sum, record) => sum + record.estimatedCostUsd, 0);

    return {
      provider,
      model,
      effort,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      cacheCreationInputTokens,
      contextTokens: last?.contextTokens ?? null,
      estimatedCostUsd: estimatedCostUsd > 0 ? estimatedCostUsd : null,
    };
  }, [records, routing, runId, fallbackUsage]);
};
