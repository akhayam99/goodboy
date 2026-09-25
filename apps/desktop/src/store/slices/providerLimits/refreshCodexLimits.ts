import { parseCodexRateLimits } from '@goodboy/core';
import type { IsoDateTime } from '@goodboy/types';
import { invoke } from '@tauri-apps/api/core';
import type { GetFn } from './types';

type CodexRateLimitsReading = {
  readonly observedAt: string | null;
  readonly rateLimits: unknown;
};

type ObservedAtParams = {
  readonly value: string | null;
};

const observedAtOf = ({ value }: ObservedAtParams): IsoDateTime | null => {
  if (value === null || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return new Date(Date.parse(value)).toISOString() as IsoDateTime;
};

export const refreshCodexLimits = (get: GetFn) => async (): Promise<void> => {
  const reading = await invoke<CodexRateLimitsReading | null>('codex_rate_limits_latest').catch(
    () => null,
  );
  if (reading == null) {
    return;
  }
  const observedAt = observedAtOf({ value: reading.observedAt });
  if (observedAt === null) {
    return;
  }
  const limits = parseCodexRateLimits({ value: reading.rateLimits, observedAt });
  if (limits === null) {
    return;
  }
  await get().recordProviderLimits({ limits });
};
