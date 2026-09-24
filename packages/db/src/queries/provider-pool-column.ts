import type { ProviderId } from '@goodboy/types';
import { PROVIDER_IDS } from '@goodboy/types';
import { isStringArray, parseJsonColumn } from '../shared/parseJsonColumn';

type ProviderPoolColumn = {
  readonly value: string | null;
};

type SerializeParams = {
  readonly pool: ReadonlyArray<ProviderId> | null | undefined;
};

export const toProviderPool = ({ value }: ProviderPoolColumn): ReadonlyArray<ProviderId> | null => {
  const parsed = parseJsonColumn({ value, isValid: isStringArray, fallback: [] });
  const known = PROVIDER_IDS.filter((provider) => parsed.includes(provider));
  return known.length === 0 ? null : known;
};

export const serializeProviderPool = ({ pool }: SerializeParams): string | null =>
  pool == null || pool.length === 0 ? null : JSON.stringify(pool);
