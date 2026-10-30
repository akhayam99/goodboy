import type { ProviderBudgetStatus } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { providerLabel } from './providerLabel';

export type MonthTier = Readonly<{
  label: string;
  spentUsd: number;
  capUsd: number;
}>;

type StatusesParams = {
  readonly statuses: Readonly<Partial<Record<string, ProviderBudgetStatus>>>;
};

export const monthTiersOf = ({ statuses }: StatusesParams): ReadonlyArray<MonthTier> =>
  Object.entries(statuses).flatMap(([provider, status]) =>
    status === undefined || status.capUsd === null || status.capUsd <= 0
      ? []
      : [{ label: providerLabel({ provider }), spentUsd: status.spentUsd, capUsd: status.capUsd }],
  );

type SessionParams = {
  readonly capUsd: number | null;
  readonly spentUsd: number | null;
};

type Params = {
  readonly session: SessionParams;
  readonly months: ReadonlyArray<MonthTier>;
};

type MonthParams = {
  readonly month: MonthTier;
};

const sessionTierOf = ({ capUsd, spentUsd }: SessionParams): ReadonlyArray<string> =>
  capUsd === null ? [] : [`Session ${formatUsd(spentUsd ?? 0)} of ${formatUsd(capUsd)}`];

const monthTextOf = ({ month }: MonthParams): string =>
  `${month.label} ${formatUsd(month.spentUsd)} of ${formatUsd(month.capUsd)} this month`;

export const limitTiersOf = ({ session, months }: Params): string =>
  [...sessionTierOf(session), ...months.map((month) => monthTextOf({ month }))].join(' · ');
