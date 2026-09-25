import type { ProviderLimitWindow, ProviderLimits } from '@goodboy/types';
import { providerLimitsStatus } from './providerLimitsStatus';

type SameWindowParams = {
  readonly left: ProviderLimitWindow;
  readonly right: ProviderLimitWindow;
};

const isSameWindow = ({ left, right }: SameWindowParams): boolean =>
  left.kind === right.kind && left.model === right.model;

type LiveParams = {
  readonly window: ProviderLimitWindow;
  readonly nowMs: number;
};

const isStillOpen = ({ window, nowMs }: LiveParams): boolean =>
  window.resetsAt === null || Date.parse(window.resetsAt) > nowMs;

type Params = {
  readonly previous: ProviderLimits | null | undefined;
  readonly next: ProviderLimits;
  readonly nowMs: number;
};

export const mergeProviderLimits = ({ previous, next, nowMs }: Params): ProviderLimits => {
  if (previous == null || previous.providerId !== next.providerId) {
    return next;
  }
  const carried = previous.windows.filter(
    (window) =>
      !next.windows.some((fresh) => isSameWindow({ left: fresh, right: window })) &&
      isStillOpen({ window, nowMs }),
  );
  const windows = [...next.windows, ...carried];
  return {
    ...next,
    plan: next.plan ?? previous.plan,
    status: providerLimitsStatus({ windows }),
    windows,
  };
};
