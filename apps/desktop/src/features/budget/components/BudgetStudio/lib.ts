import type { ProviderName, SessionId, TelemetryRecord } from '@goodboy/types';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL_LOWER } from '../../../providers/providers';

export type BudgetScope =
  | { readonly kind: 'overview' }
  | { readonly kind: 'provider'; readonly provider: ProviderName }
  | { readonly kind: 'session'; readonly sessionId: SessionId };

export type SortKey = 'recent' | 'expensive';

export type WorkspaceTurn = {
  readonly record: TelemetryRecord;
  readonly sessionId: SessionId;
  readonly sessionGoal: string;
};

export type SessionSpend = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly spentUsd: number;
  readonly turnCount: number;
  readonly isCurrent: boolean;
};

export type ModelBreakdownEntry = {
  readonly provider: string;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly spentUsd: number;
};

const PROVIDER_IDS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
];
export const toProviderId = (provider: string): ProviderId | null => {
  return PROVIDER_IDS.includes(provider as ProviderId) ? (provider as ProviderId) : null;
};

export const providerLabel = (provider: string): string => {
  const id = toProviderId(provider);
  return id === null ? provider : PROVIDER_LABEL_LOWER[id];
};

export const spendBarColor = (pct: number): string => {
  if (pct >= 1) {
    return 'bg-danger';
  }
  if (pct >= 0.8) {
    return 'bg-warning';
  }
  return 'bg-primary';
};

export const spendStrokeColor = (pct: number): string => {
  if (pct >= 1) {
    return 'var(--color-danger)';
  }
  if (pct >= 0.8) {
    return 'var(--color-warning)';
  }
  return 'var(--color-primary)';
};

export const sortTurns = (
  turns: ReadonlyArray<WorkspaceTurn>,
  key: SortKey,
): ReadonlyArray<WorkspaceTurn> => {
  const copy = [...turns];
  if (key === 'expensive') {
    copy.sort((a, b) => b.record.estimatedCostUsd - a.record.estimatedCostUsd);
  } else {
    copy.sort((a, b) => Date.parse(b.record.recordedAt) - Date.parse(a.record.recordedAt));
  }
  return copy;
};

export const buildModelBreakdown = (
  records: ReadonlyArray<TelemetryRecord>,
): ReadonlyArray<ModelBreakdownEntry> => {
  const map = new Map<string, ModelBreakdownEntry>();
  for (const r of records) {
    const key = `${r.provider}//${r.model}`;
    const prev = map.get(key) ?? {
      provider: r.provider,
      model: r.model,
      tokensIn: 0,
      tokensOut: 0,
      spentUsd: 0,
    };
    map.set(key, {
      provider: prev.provider,
      model: prev.model,
      tokensIn: prev.tokensIn + r.inputTokens,
      tokensOut: prev.tokensOut + r.outputTokens,
      spentUsd: prev.spentUsd + r.estimatedCostUsd,
    });
  }
  return [...map.values()].sort((a, b) => b.spentUsd - a.spentUsd);
};

export const chronologicalTurnCosts = (
  records: ReadonlyArray<TelemetryRecord>,
): ReadonlyArray<number> => {
  return [...records]
    .filter((r) => r.kind === 'turn')
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))
    .map((r) => r.estimatedCostUsd);
};
