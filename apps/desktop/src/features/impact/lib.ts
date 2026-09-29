import type { ProviderName, SessionId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';

export type ImpactWindowId = 'last7' | 'last30' | 'all';
export type ImpactTab = 'overview' | 'shipped' | 'flow' | 'spend';
export type ImpactMetricGroup = 'overview' | 'shipped' | 'flow' | 'efficiency';

export type ImpactScope =
  | { readonly kind: ImpactTab }
  | { readonly kind: 'provider'; readonly provider: ProviderName }
  | { readonly kind: 'session'; readonly sessionId: SessionId };

const DAY_MS = 86_400_000;

const IMPACT_WINDOW_DAYS = {
  last7: 7,
  last30: 30,
} satisfies Record<Exclude<ImpactWindowId, 'all'>, number>;

export const IMPACT_WINDOW_OPTIONS: ReadonlyArray<SegmentedTabOption<ImpactWindowId>> = [
  { value: 'last7', label: '7 days' },
  { value: 'last30', label: '30 days' },
  { value: 'all', label: 'All time' },
];

export const IMPACT_TAB_OPTIONS: ReadonlyArray<SegmentedTabOption<ImpactTab>> = [
  { value: 'overview', label: 'Overview' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'flow', label: 'Flow' },
  { value: 'spend', label: 'Spend' },
];

type WindowParams = {
  readonly windowId: ImpactWindowId;
};

type WindowStartParams = WindowParams & {
  readonly nowMs: number;
};

type ScopeParams = {
  readonly scope: ImpactScope;
};

export const impactWindowMs = ({ windowId }: WindowParams): number | null =>
  windowId === 'all' ? null : IMPACT_WINDOW_DAYS[windowId] * DAY_MS;

export const impactWindowStart = ({ windowId, nowMs }: WindowStartParams): number | null => {
  const windowMs = impactWindowMs({ windowId });
  return windowMs === null ? null : nowMs - windowMs;
};

export const impactTabOf = ({ scope }: ScopeParams): ImpactTab =>
  scope.kind === 'provider' || scope.kind === 'session' ? 'spend' : scope.kind;
