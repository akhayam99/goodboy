import type { ProviderUsage, TurnEvent } from '@goodboy/types';

type UsageEvent = Extract<TurnEvent, { kind: 'usage' }>;

type Params = {
  readonly event: UsageEvent;
  readonly events: ReadonlyArray<TurnEvent>;
};

type Totals = {
  readonly premiumRequests: number;
  readonly nanoAiu: number;
};

const PREMIUM_PRECISION = 1_000_000;

type ShareParams = {
  readonly total: number;
  readonly previous: number;
};

const shareOf = ({ total, previous }: ShareParams): number =>
  Math.max(0, Math.round((total - previous) * PREMIUM_PRECISION) / PREMIUM_PRECISION);

type SessionParams = {
  readonly event: UsageEvent;
  readonly events: ReadonlyArray<TurnEvent>;
};

const runSessionIdOf = ({ event, events }: SessionParams): string | null => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const candidate = events[index];
    if (candidate?.kind === 'provider_session_init' && candidate.runId === event.runId) {
      return candidate.providerSessionId;
    }
  }
  return null;
};

type PreviousParams = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly providerSessionId: string | null;
};

const previousTotals = ({ events, providerSessionId }: PreviousParams): Totals => {
  let current: string | null = null;
  let totals: Totals = { premiumRequests: 0, nanoAiu: 0 };
  if (providerSessionId === null) {
    return totals;
  }
  for (const candidate of events) {
    if (candidate.kind === 'provider_session_init') {
      current = candidate.providerSessionId;
      continue;
    }
    if (candidate.kind !== 'usage' || current !== providerSessionId) {
      continue;
    }
    totals = {
      premiumRequests: candidate.usage.sessionPremiumRequests ?? totals.premiumRequests,
      nanoAiu: candidate.usage.sessionNanoAiu ?? totals.nanoAiu,
    };
  }
  return totals;
};

export const copilotTurnUsage = ({ event, events }: Params): UsageEvent => {
  const { sessionPremiumRequests, sessionNanoAiu } = event.usage;
  if (sessionPremiumRequests === undefined && sessionNanoAiu === undefined) {
    return event;
  }
  const previous = previousTotals({
    events,
    providerSessionId: runSessionIdOf({ event, events }),
  });
  const usage: ProviderUsage = {
    ...event.usage,
    ...(sessionPremiumRequests !== undefined && {
      premiumRequests: shareOf({
        total: sessionPremiumRequests,
        previous: previous.premiumRequests,
      }),
    }),
    ...(sessionNanoAiu !== undefined && {
      nanoAiu: shareOf({ total: sessionNanoAiu, previous: previous.nanoAiu }),
    }),
  };
  return { ...event, usage };
};
