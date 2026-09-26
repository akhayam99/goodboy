import { formatUsd, type Tone } from '@goodboy/ui';
import type { SessionBudget } from '@goodboy/types';

export type SessionSpendLevel = 'free' | 'clear' | 'near' | 'over';

export type SessionSpendPresentation = {
  readonly level: SessionSpendLevel;
  readonly tone: Tone;
  readonly label: string;
  readonly ratio: number | null;
  readonly isPaused: boolean;
};

export const SPEND_NEAR_RATIO = 0.8;

type Params = {
  readonly totalUsd: number;
  readonly limit: SessionBudget | null;
};

export const sessionSpendPresentation = ({ totalUsd, limit }: Params): SessionSpendPresentation => {
  if (limit === null) {
    return {
      level: 'free',
      tone: 'neutral',
      label: formatUsd(totalUsd),
      ratio: null,
      isPaused: false,
    };
  }
  const ratio = limit.softCapUsd > 0 ? totalUsd / limit.softCapUsd : 1;
  const amounts = `${formatUsd(totalUsd)} of ${formatUsd(limit.softCapUsd)}`;
  if (ratio >= 1) {
    const isPaused = limit.onExceed === 'pause';
    return {
      level: 'over',
      tone: 'danger',
      label: isPaused ? `Paused · ${amounts}` : amounts,
      ratio,
      isPaused,
    };
  }
  if (ratio >= SPEND_NEAR_RATIO) {
    return { level: 'near', tone: 'warning', label: amounts, ratio, isPaused: false };
  }
  return { level: 'clear', tone: 'neutral', label: amounts, ratio, isPaused: false };
};
