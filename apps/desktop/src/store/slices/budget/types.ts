import type { ProviderTelemetrySummary } from '@goodboy/db';
import type { AppStore } from '../../store';

export type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
export type GetFn = () => AppStore;

export interface ProviderSpendEntry {
  readonly provider: ProviderTelemetrySummary['provider'];
  readonly spentUsd: number;
  readonly capUsd: number | null;
  readonly pct: number;
}
