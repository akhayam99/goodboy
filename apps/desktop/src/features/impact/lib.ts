import type { ProviderName, SessionId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';

export type ImpactWindowId = 'last30' | 'all';
export type ImpactScopeId = 'overview' | 'shipped' | 'flow' | 'efficiency';

export type ImpactScope =
  | { readonly kind: ImpactScopeId }
  | { readonly kind: 'provider'; readonly provider: ProviderName }
  | { readonly kind: 'session'; readonly sessionId: SessionId };

export const IMPACT_WINDOW_DAYS = 30;

export const IMPACT_WINDOW_OPTIONS: ReadonlyArray<SegmentedTabOption<ImpactWindowId>> = [
  { value: 'last30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];
