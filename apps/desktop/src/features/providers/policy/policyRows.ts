import { limitsChipOf, seedProviderPolicy, sortLimitWindows } from '@goodboy/core';
import type {
  IsoDateTime,
  ProviderId,
  ProviderLimits,
  ProviderPolicy,
  ProviderPolicyEntry,
  ProviderPolicyState,
} from '@goodboy/types';
import { formatUsedPercent } from '../limits/formatUsedPercent';
import { limitWindowLabel } from '../limits/limitWindowLabel';

export type PolicyRow = Readonly<{
  id: ProviderId;
  state: ProviderPolicyState;
  isNew: boolean;
  isDefault: boolean;
  payAsYouGo: boolean;
  keepAfterLimit: boolean;
  limitResetsAt: IsoDateTime | null;
  isAtLimit: boolean;
  usage: string | null;
}>;

type RowsParams = {
  readonly policy: ProviderPolicy | null;
  readonly defaultProvider: ProviderId;
  readonly connected: ReadonlyArray<ProviderId>;
  readonly limits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
  readonly nowMs: number;
};

type UsageParams = {
  readonly windows: ProviderLimits['windows'];
};

type LimitParams = Pick<RowsParams, 'limits' | 'nowMs'> & {
  readonly id: ProviderId;
};

const usageOf = ({ windows }: UsageParams): string | null => {
  const sorted = sortLimitWindows({ windows });
  const parts = sorted.flatMap((window) =>
    window.usedFraction === null
      ? []
      : [
          `${limitWindowLabel({ window, siblings: sorted })} ${formatUsedPercent({ usedFraction: window.usedFraction })} used`,
        ],
  );
  return parts.length === 0 ? null : parts.join(', ');
};

const limitOf = ({ id, limits, nowMs }: LimitParams) => {
  const chip = limitsChipOf({ providerId: id, limits: limits[id], nowMs });
  return {
    isAtLimit: chip.state === 'out',
    limitResetsAt: chip.resetsAt,
    usage: usageOf({ windows: chip.windows }),
  };
};

export const basePolicy = ({
  policy,
  defaultProvider,
  connected,
}: Pick<RowsParams, 'policy' | 'defaultProvider' | 'connected'>): ProviderPolicy =>
  policy ?? seedProviderPolicy({ defaultProvider, connected });

export const policyRows = (params: RowsParams): ReadonlyArray<PolicyRow> => {
  const base = basePolicy(params);
  const known = base.filter((entry) => params.connected.includes(entry.id));
  const fresh = params.connected
    .filter((id) => !base.some((entry) => entry.id === id))
    .map((id): ProviderPolicyEntry => ({ id, state: 'off' }));
  const firstOn = known.find((entry) => entry.state === 'on')?.id ?? null;
  return [
    ...known.map((entry) => ({ entry, isNew: false })),
    ...fresh.map((entry) => ({ entry, isNew: true })),
  ].map(({ entry, isNew }) => ({
    id: entry.id,
    state: entry.state,
    isNew,
    isDefault: entry.id === firstOn,
    payAsYouGo: entry.payAsYouGo === true,
    keepAfterLimit: entry.keepAfterLimit === true,
    ...limitOf({ id: entry.id, limits: params.limits, nowMs: params.nowMs }),
  }));
};

type WriteParams = {
  readonly rows: ReadonlyArray<PolicyRow>;
  readonly base: ProviderPolicy;
};

export const policyFromRows = ({ rows, base }: WriteParams): ProviderPolicy => [
  ...rows
    .filter((row) => !row.isNew)
    .map((row): ProviderPolicyEntry => ({
      id: row.id,
      state: row.state,
      ...(row.payAsYouGo && { payAsYouGo: true }),
      ...(row.keepAfterLimit && { keepAfterLimit: true }),
    })),
  ...base.filter((entry) => !rows.some((row) => row.id === entry.id)),
];

type MoveParams = {
  readonly rows: ReadonlyArray<PolicyRow>;
  readonly from: number;
  readonly to: number;
};

export const moveRow = ({ rows, from, to }: MoveParams): ReadonlyArray<PolicyRow> => {
  const moved = rows[from];
  if (moved === undefined || to < 0 || to >= rows.length || to === from) {
    return rows;
  }
  const rest = rows.filter((_, index) => index !== from);
  return [...rest.slice(0, to), moved, ...rest.slice(to)];
};
