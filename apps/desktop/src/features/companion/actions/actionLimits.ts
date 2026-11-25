import type { DecideKind } from './decideAction';

type Window = {
  readonly max: number;
  readonly windowMs: number;
};

const MINUTE_MS = 60_000;

export const RATE_WINDOWS = {
  answerQuestion: { max: 20, windowMs: MINUTE_MS },
  approvePlan: { max: 6, windowMs: MINUTE_MS },
  requestPlanChanges: { max: 10, windowMs: MINUTE_MS },
  answerPermission: { max: 30, windowMs: MINUTE_MS },
  raiseLimit: { max: 6, windowMs: MINUTE_MS },
  undoRaiseLimit: { max: 6, windowMs: MINUTE_MS },
  stopRun: { max: 12, windowMs: MINUTE_MS },
  continueRun: { max: 12, windowMs: MINUTE_MS },
  stopAgent: { max: 12, windowMs: MINUTE_MS },
  continueAgent: { max: 12, windowMs: MINUTE_MS },
  stopAgentTree: { max: 12, windowMs: MINUTE_MS },
  sendToAgent: { max: 30, windowMs: MINUTE_MS },
  answerSlackReply: { max: 10, windowMs: MINUTE_MS },
} as const satisfies Record<DecideKind, Window>;

export const MAX_TEXT_LENGTH = 4000;

export const MAX_RAISED_LIMIT_USD = 500;

const stamps = new Map<DecideKind, number[]>();

type SlotParams = {
  readonly kind: DecideKind;
  readonly now: number;
};

export const takeRateSlot = ({ kind, now }: SlotParams): boolean => {
  const { max, windowMs } = RATE_WINDOWS[kind];
  const recent = (stamps.get(kind) ?? []).filter((at) => at > now - windowMs);
  if (recent.length >= max) {
    stamps.set(kind, recent);
    return false;
  }
  stamps.set(kind, [...recent, now]);
  return true;
};

export const clearRateSlots = (): void => {
  stamps.clear();
};

type OffersParams = {
  readonly currentLimit: number;
};

type RoundParams = {
  readonly value: number;
};

const roundedUsd = ({ value }: RoundParams): number => Math.round(value * 100) / 100;

export const limitOffersOf = ({ currentLimit }: OffersParams): ReadonlyArray<number> => {
  if (!Number.isFinite(currentLimit) || currentLimit <= 0) {
    return [];
  }
  const candidates = [currentLimit + 5, currentLimit + 10, currentLimit * 2].map((value) =>
    roundedUsd({ value }),
  );
  const unique = [...new Set(candidates)].filter(
    (amount) => amount > currentLimit && amount <= MAX_RAISED_LIMIT_USD,
  );
  return unique.sort((left, right) => left - right);
};
