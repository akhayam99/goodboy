import type { ProviderId, ProviderLimitWindow, ProviderLimits } from '@goodboy/types';

export type LimitRow = {
  readonly key: string;
  readonly providerId: ProviderId;
  readonly window: ProviderLimitWindow;
  readonly siblings: ReadonlyArray<ProviderLimitWindow>;
};

type Params = {
  readonly order: ReadonlyArray<ProviderId>;
  readonly connected: ReadonlyArray<ProviderId>;
  readonly limits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
};

export const limitRowsOf = ({ order, connected, limits }: Params): ReadonlyArray<LimitRow> =>
  order
    .filter((providerId) => connected.includes(providerId))
    .flatMap((providerId) => {
      const windows = limits[providerId]?.windows ?? [];
      return windows.map((window, index) => ({
        key: `${providerId}:${window.kind}:${window.model ?? ''}:${index}`,
        providerId,
        window,
        siblings: windows,
      }));
    });

type TightestParams = {
  readonly rows: ReadonlyArray<LimitRow>;
};

export const tightestOf = ({ rows }: TightestParams): LimitRow | null =>
  rows.reduce<LimitRow | null>((tightest, row) => {
    const used = row.window.usedFraction ?? -1;
    return tightest === null || used > (tightest.window.usedFraction ?? -1) ? row : tightest;
  }, null);
