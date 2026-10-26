import { formatUsd, type Tone } from '@goodboy/ui';
import type { SessionBudget } from '@goodboy/types';

type SessionSpendLevel = 'free' | 'clear' | 'near' | 'over';

export type SessionSpendPresentation = {
  readonly level: SessionSpendLevel;
  readonly tone: Tone;
  readonly label: string;
  readonly compactLabel: string;
  readonly sentence: string;
  readonly ratio: number | null;
  readonly isPaused: boolean;
};

type Params = {
  readonly totalUsd: number;
  readonly limit: SessionBudget | null;
};

type UsdParams = {
  readonly usd: number;
};

const limitUsd = ({ usd }: UsdParams): string =>
  Number.isInteger(usd) ? `$${usd}` : formatUsd(usd);

type LevelParams = {
  readonly ratio: number;
  readonly warnRatio: number;
};

const levelOf = ({ ratio, warnRatio }: LevelParams): SessionSpendLevel => {
  if (ratio >= 1) {
    return 'over';
  }
  return ratio >= warnRatio ? 'near' : 'clear';
};

const TONE: Readonly<Record<SessionSpendLevel, Tone>> = {
  free: 'neutral',
  clear: 'neutral',
  near: 'warning',
  over: 'danger',
};

export const sessionSpendPresentation = ({ totalUsd, limit }: Params): SessionSpendPresentation => {
  if (limit === null) {
    return {
      level: 'free',
      tone: 'neutral',
      label: formatUsd(totalUsd),
      compactLabel: formatUsd(totalUsd),
      sentence: `${formatUsd(totalUsd)} spent in this session`,
      ratio: null,
      isPaused: false,
    };
  }
  const capUsd = limit.softCapUsd;
  const ratio = capUsd > 0 ? totalUsd / capUsd : 1;
  const level = levelOf({ ratio, warnRatio: limit.warnRatio });
  const isPaused = level === 'over' && limit.onExceed === 'pause';
  const amounts = `${formatUsd(totalUsd)} of ${formatUsd(capUsd)}`;
  const spent = `${formatUsd(totalUsd)} spent of the ${formatUsd(capUsd)} limit in this session`;
  return {
    level,
    tone: TONE[level],
    label: isPaused ? `Paused · ${amounts}` : amounts,
    compactLabel: `${formatUsd(totalUsd)} / ${limitUsd({ usd: capUsd })}`,
    sentence: isPaused ? `Paused, ${spent}` : spent,
    ratio,
    isPaused,
  };
};
