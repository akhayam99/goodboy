import type { IsoDateTime, ProviderRunId, SessionId } from './ids';
import type { RoutingDecision } from './budget';

export type ProviderName =
  'anthropic' | 'openai' | 'cursor' | 'codex' | 'gemini' | 'opencode' | 'openrouter' | 'moonshot';

export const PROVIDER_NAMES = [
  'anthropic',
  'openai',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] satisfies ReadonlyArray<ProviderName>;

export const isProviderName = (value: unknown): value is ProviderName =>
  typeof value === 'string' && PROVIDER_NAMES.some((provider) => provider === value);

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
