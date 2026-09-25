import type { IsoDateTime } from './ids';
import type { ProviderId } from './provider-registry';

export type ProviderLimitStatus = 'ok' | 'warning' | 'reached';

export type ProviderLimitWindowKind = 'fiveHour' | 'weekly' | 'weeklyModel';

export type ProviderLimitWindow = Readonly<{
  kind: ProviderLimitWindowKind;
  model: string | null;
  status: ProviderLimitStatus;
  usedFraction: number | null;
  resetsAt: IsoDateTime | null;
}>;

export type ProviderLimits = Readonly<{
  providerId: ProviderId;
  plan: string | null;
  status: ProviderLimitStatus;
  windows: ReadonlyArray<ProviderLimitWindow>;
  observedAt: IsoDateTime;
}>;
