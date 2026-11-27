import type { ProviderLimitWindow } from '@goodboy/types';
import { formatLimitReset, formatTimeUntil } from './formatLimitReset';
import { formatUsedPercent } from './formatUsedPercent';
import { limitWindowLabel } from './limitWindowLabel';
import { windowTone, type WindowTone } from './windowTone';

type Params = {
  readonly window: ProviderLimitWindow;
  readonly siblings: ReadonlyArray<ProviderLimitWindow>;
  readonly nowMs: number;
};

export type UsageWindowFacts = {
  readonly label: string;
  readonly tone: WindowTone;
  readonly fraction: number | null;
  readonly percentText: string | null;
  readonly resetText: string;
};

type ResetParams = Pick<Params, 'window' | 'nowMs'>;

const resetTextOf = ({ window, nowMs }: ResetParams): string => {
  if (window.resetsAt === null) {
    return '';
  }
  const at = formatLimitReset({ iso: window.resetsAt, nowMs });
  const isOut = window.status === 'reached' || (window.usedFraction ?? 0) >= 1;
  if (isOut) {
    return `Out until ${at}`;
  }
  const until = formatTimeUntil({ iso: window.resetsAt, nowMs });
  return until === '' ? `Resets ${at}` : `Resets ${at} · ${until}`;
};

export const usageWindowFactsOf = ({ window, siblings, nowMs }: Params): UsageWindowFacts => ({
  label: limitWindowLabel({ window, siblings }),
  tone: windowTone({ window }),
  fraction: window.usedFraction,
  percentText:
    window.usedFraction === null ? null : formatUsedPercent({ usedFraction: window.usedFraction }),
  resetText: resetTextOf({ window, nowMs }),
});
