import {
  parseCodexAppServerLimits,
  parseCodexRateLimits,
  parseCodexResetCredits,
} from '@goodboy/core';
import type { CodexResetCredits, IsoDateTime } from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { markProbe } from './markProbe';
import type { GetFn, RefreshCodexLimitsParams, SetFn } from './types';

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

const readRollout = async (get: GetFn): Promise<void> => {
  const reading = await invokeCommand<CodexRateLimitsReading | null>(
    'codex_rate_limits_latest',
  ).catch(() => null);
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

type MergeCreditsParams = {
  readonly previous: CodexResetCredits | null;
  readonly next: CodexResetCredits | null;
};

const mergeCredits = ({ previous, next }: MergeCreditsParams): CodexResetCredits | null => {
  if (next === null || next.creditId !== null || previous === null) {
    return next;
  }
  if (previous.availableCount !== next.availableCount) {
    return next;
  }
  return { ...next, creditId: previous.creditId, expiresAt: previous.expiresAt };
};

export const refreshCodexLimits =
  (set: SetFn, get: GetFn) =>
  async ({ withResetDetails = false }: RefreshCodexLimitsParams = {}): Promise<void> => {
    const authState = get().authResults?.codex ?? null;
    if (authState !== null && authState.state === 'disconnected') {
      return;
    }
    markProbe({ set, providerId: 'codex', outcome: 'checking' });
    const response = await invokeCommand<unknown>('codex_rate_limits_probe', {
      includeResetCreditDetails: withResetDetails,
    }).catch(() => null);
    const observedAt = new Date().toISOString() as IsoDateTime;
    const limits =
      response == null ? null : parseCodexAppServerLimits({ value: response, observedAt });
    if (limits === null) {
      markProbe({ set, providerId: 'codex', outcome: 'failed' });
      await readRollout(get);
      return;
    }
    set({
      codexResetCredits: mergeCredits({
        previous: get().codexResetCredits,
        next: parseCodexResetCredits({ value: response, observedAt }),
      }),
    });
    markProbe({ set, providerId: 'codex', outcome: 'ok' });
    await get().recordProviderLimits({ limits });
  };
