import {
  insertTelemetry,
  summarizeProviderTelemetry,
  summarizeSessionTelemetry,
  summarizeWorkspaceTelemetry,
  type Database,
  type TelemetrySummary,
} from '@goodboy/db';
import type {
  IsoDateTime,
  ProviderAdapter,
  ProviderName,
  ProviderRunId,
  ProviderUsage,
  SessionId,
  TelemetryKind,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';

export type RecordTurnInput = {
  readonly runId: ProviderRunId;
  readonly sessionId: SessionId;
  readonly model: string;
  readonly usage: ProviderUsage;
};

export type RecordSummarizerInput = {
  readonly runId: ProviderRunId;
  readonly sessionId: SessionId;
  readonly model: string;
  readonly usage: ProviderUsage;
  readonly costUsd: number;
};

export type TelemetryRecorderDeps = {
  readonly db: Database;
  readonly adapter: ProviderAdapter;
  readonly newId: () => TelemetryRecordId;
  readonly now: () => IsoDateTime;
};

export class TelemetryRecorder {
  constructor(private readonly deps: TelemetryRecorderDeps) {}

  async recordTurn(input: RecordTurnInput): Promise<TelemetryRecord> {
    const cost = this.deps.adapter.cost(input.usage, input.model);
    return this.persist({
      kind: 'turn',
      runId: input.runId,
      sessionId: input.sessionId,
      provider: this.deps.adapter.id,
      model: input.model,
      usage: input.usage,
      costUsd: cost,
    });
  }

  async recordSummarizer(input: RecordSummarizerInput): Promise<TelemetryRecord> {
    return this.persist({
      kind: 'summarizer',
      runId: input.runId,
      sessionId: input.sessionId,
      provider: this.deps.adapter.id,
      model: input.model,
      usage: input.usage,
      costUsd: input.costUsd,
    });
  }

  sessionSummary(sessionId: SessionId): Promise<TelemetrySummary> {
    return summarizeSessionTelemetry(this.deps.db, sessionId);
  }

  workspaceSummary(workspaceId: WorkspaceId): Promise<TelemetrySummary> {
    return summarizeWorkspaceTelemetry(this.deps.db, workspaceId);
  }

  providerSummary(provider: ProviderName): Promise<TelemetrySummary> {
    return summarizeProviderTelemetry(this.deps.db, provider);
  }

  private async persist(args: {
    kind: TelemetryKind;
    runId: ProviderRunId;
    sessionId: SessionId;
    provider: ProviderName;
    model: string;
    usage: ProviderUsage;
    costUsd: number;
  }): Promise<TelemetryRecord> {
    const record: TelemetryRecord = {
      id: this.deps.newId(),
      runId: args.runId,
      sessionId: args.sessionId,
      kind: args.kind,
      provider: args.provider,
      model: args.model,
      inputTokens: args.usage.inputTokens,
      outputTokens: args.usage.outputTokens,
      estimatedCostUsd: args.costUsd,
      recordedAt: this.deps.now(),
    };
    await insertTelemetry(this.deps.db, record);
    return record;
  }
}
