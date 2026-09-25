import {
  PROVIDER_IDS,
  type IsoDateTime,
  type ProviderId,
  type ProviderLimitStatus,
  type ProviderLimitWindow,
  type ProviderLimits,
} from '@goodboy/types';
import type { Database } from '../client';
import { parseJsonColumn } from '../shared/parseJsonColumn';

type ProviderLimitsRow = {
  provider_id: string;
  plan: string | null;
  status: string;
  windows: string | null;
  observed_at: number;
};

const WINDOW_KINDS: ReadonlyArray<ProviderLimitWindow['kind']> = [
  'fiveHour',
  'weekly',
  'weeklyModel',
];

const STATUSES: ReadonlyArray<ProviderLimitStatus> = ['ok', 'warning', 'reached'];

const isStatus = (value: unknown): value is ProviderLimitStatus =>
  STATUSES.some((status) => status === value);

const isProviderId = (value: unknown): value is ProviderId =>
  PROVIDER_IDS.some((providerId) => providerId === value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isWindow = (value: unknown): value is ProviderLimitWindow => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const usedFraction: unknown = Reflect.get(value, 'usedFraction');
  return (
    WINDOW_KINDS.some((kind) => kind === Reflect.get(value, 'kind')) &&
    isNullableString(Reflect.get(value, 'model')) &&
    isStatus(Reflect.get(value, 'status')) &&
    (usedFraction === null || typeof usedFraction === 'number') &&
    isNullableString(Reflect.get(value, 'resetsAt'))
  );
};

const isWindowList = (value: unknown): value is ReadonlyArray<ProviderLimitWindow> =>
  Array.isArray(value) && value.every(isWindow);

type ToDomainParams = {
  readonly row: ProviderLimitsRow;
};

const toDomain = ({ row }: ToDomainParams): ProviderLimits | null => {
  if (!isProviderId(row.provider_id) || !isStatus(row.status)) {
    return null;
  }
  return {
    providerId: row.provider_id,
    plan: row.plan,
    status: row.status,
    windows: parseJsonColumn({ value: row.windows, isValid: isWindowList, fallback: [] }),
    observedAt: new Date(row.observed_at).toISOString() as IsoDateTime,
  };
};

type ListParams = {
  readonly db: Database;
};

export const listProviderLimits = async ({
  db,
}: ListParams): Promise<ReadonlyArray<ProviderLimits>> => {
  const rows = await db.select<ProviderLimitsRow>(
    'SELECT provider_id, plan, status, windows, observed_at FROM provider_limits ORDER BY provider_id',
  );
  return rows.flatMap((row) => {
    const limits = toDomain({ row });
    return limits === null ? [] : [limits];
  });
};

type UpsertParams = {
  readonly db: Database;
  readonly limits: ProviderLimits;
  readonly nowMs: number;
};

export const upsertProviderLimits = async ({ db, limits, nowMs }: UpsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO provider_limits (provider_id, plan, status, windows, observed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider_id) DO UPDATE SET
       plan = excluded.plan,
       status = excluded.status,
       windows = excluded.windows,
       observed_at = excluded.observed_at,
       updated_at = excluded.updated_at
     WHERE excluded.observed_at >= provider_limits.observed_at`,
    [
      limits.providerId,
      limits.plan,
      limits.status,
      JSON.stringify(limits.windows),
      Date.parse(limits.observedAt),
      nowMs,
      nowMs,
    ],
  );
};
