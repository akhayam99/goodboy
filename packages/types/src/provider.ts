import type { IsoDateTime, ProviderRunId, SessionId } from './ids';
import type { RoutingDecision } from './budget';

export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'cursor'
  | 'codex'
  | 'gemini'
  | 'opencode'
  | 'openrouter';

export type ProviderRunStatus =
  | { kind: 'pending' }
  | { kind: 'streaming'; startedAt: IsoDateTime }
  | { kind: 'succeeded'; finishedAt: IsoDateTime }
  | { kind: 'failed'; finishedAt: IsoDateTime; error: string }
  | { kind: 'cancelled'; finishedAt: IsoDateTime };

export type ProviderRun = Readonly<{
  id: ProviderRunId;
  sessionId: SessionId;
  provider: ProviderName;
  model: string;
  status: ProviderRunStatus;
  routingDecision?: RoutingDecision;
  createdAt: IsoDateTime;
}>;
