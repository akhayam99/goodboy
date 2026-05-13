import type { IsoDateTime, ProviderRunId, TaskId } from './ids';
import type { RoutingDecision } from './budget';

export type ProviderName = 'anthropic' | 'openai' | 'cursor' | 'codex' | 'opencode';

export type ProviderRunStatus =
  | { kind: 'pending' }
  | { kind: 'streaming'; startedAt: IsoDateTime }
  | { kind: 'succeeded'; finishedAt: IsoDateTime }
  | { kind: 'failed'; finishedAt: IsoDateTime; error: string }
  | { kind: 'cancelled'; finishedAt: IsoDateTime };

export type ProviderRun = Readonly<{
  id: ProviderRunId;
  taskId: TaskId;
  provider: ProviderName;
  model: string;
  status: ProviderRunStatus;
  routingDecision?: RoutingDecision;
  createdAt: IsoDateTime;
}>;
