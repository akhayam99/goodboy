import type { LimitsChip } from '@goodboy/core';
import { formatLimitResetShort } from './formatLimitReset';
import { formatUsedPercent } from './formatUsedPercent';

export type LimitsRailStatus = Readonly<{
  tone: 'warning' | 'danger';
  subtitle: string;
}>;

type Params = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

const SHORT_WINDOW: Readonly<Record<'fiveHour' | 'weekly' | 'weeklyModel', string>> = {
  fiveHour: '5-hour',
  weekly: 'week',
  weeklyModel: 'week',
};

export const limitsRailStatus = ({ chip, nowMs }: Params): LimitsRailStatus | null => {
  if (chip.state === 'out') {
    return {
      tone: 'danger',
      subtitle:
        chip.resetsAt === null
          ? 'Out'
          : `Out until ${formatLimitResetShort({ iso: chip.resetsAt, nowMs })}`,
    };
  }
  if (chip.state !== 'warning') {
    return null;
  }
  if (chip.usedFraction === null || chip.window === null) {
    return { tone: 'warning', subtitle: 'Near its limit' };
  }
  return {
    tone: 'warning',
    subtitle: `${formatUsedPercent({ usedFraction: chip.usedFraction })} of ${SHORT_WINDOW[chip.window.kind]} used`,
  };
};
