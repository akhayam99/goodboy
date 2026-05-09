import {
  insertTelemetry,
  summarizeProviderTelemetry,
  summarizeTaskTelemetry,
  summarizeWorkspaceTelemetry,
  type Database,
  type TelemetrySummary,
} from '@kay-am/db';
import type {
  IsoDateTime,
  ProviderAdapter,
  ProviderName,
  ProviderRunId,
  ProviderUsage,
  TaskId,
  TelemetryKind,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@kay-am/types';

export interface RecordTurnInput {
  readonly runId: ProviderRunId;
  readonly taskId: TaskId;
  readonly model: string;
  readonly usage: ProviderUsage;
}

export interface RecordSummarizerInput {
  readonly runId: ProviderRunId;
  readonly taskId: TaskId;
  readonly model: string;
  readonly usage: ProviderUsage;
  readonly costUsd: number;
}

export interface TelemetryRecorderDeps {
  readonly db: Database;
  readonly adapter: ProviderAdapter;
  readonly newId: () => TelemetryRecordId;
  readonly now: () => IsoDateTime;
}

export class TelemetryRecorder {
  constructor(private readonly deps: TelemetryRecorderDeps) {}

  async recordTurn(input: RecordTurnInput): Promise<TelemetryRecord> {
    const cost = this.deps.adapter.cost(input.usage, input.model);
    return this.persist({
      kind: 'turn',
      runId: input.runId,
      taskId: input.taskId,
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
      taskId: input.taskId,
      provider: this.deps.adapter.id,
      model: input.model,
      usage: input.usage,
      costUsd: input.costUsd,
    });
  }

  sessionSummary(taskId: TaskId): Promise<TelemetrySummary> {
    return summarizeTaskTelemetry(this.deps.db, taskId);
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
    taskId: TaskId;
    provider: ProviderName;
    model: string;
    usage: ProviderUsage;
    costUsd: number;
  }): Promise<TelemetryRecord> {
    const record: TelemetryRecord = {
      id: this.deps.newId(),
      runId: args.runId,
      taskId: args.taskId,
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
