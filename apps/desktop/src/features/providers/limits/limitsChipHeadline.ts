import type { LimitsChip } from '@goodboy/core';
import type { ProviderLimitWindow } from '@goodboy/types';
import { formatRelativeAge } from '../../../shared/utils/relativeDate';
import { PROVIDER_LABEL } from '../providerLabel';
import { formatLimitReset } from './formatLimitReset';
import { formatUsedPercent } from './formatUsedPercent';

type WindowNounParams = {
  readonly window: ProviderLimitWindow;
};

const windowNoun = ({ window }: WindowNounParams): string => {
  switch (window.kind) {
    case 'fiveHour':
      return 'the 5-hour window';
    case 'weekly':
      return 'the week';
    case 'weeklyModel':
      return `the ${window.model ?? 'model'} week`;
    default: {
      const exhaustive: never = window.kind;
      return exhaustive;
    }
  }
};

type BackParams = {
  readonly iso: string;
  readonly nowMs: number;
};

const backAt = ({ iso, nowMs }: BackParams): string => {
  const reset = formatLimitReset({ iso, nowMs });
  return reset.includes(' ') ? reset : `today ${reset}`;
};

type Params = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

const usedLine = ({ chip }: Pick<Params, 'chip'>): string => {
  const name =
    chip.plan === null
      ? PROVIDER_LABEL[chip.providerId]
      : `${PROVIDER_LABEL[chip.providerId]} ${chip.plan}`;
  if (chip.window === null || chip.usedFraction === null) {
    return `${name} is within its limits`;
  }
  return `${name} · ${formatUsedPercent({ usedFraction: chip.usedFraction })} of ${windowNoun({ window: chip.window })} used`;
};

export const limitsChipHeadline = ({ chip, nowMs }: Params): string => {
  const label = PROVIDER_LABEL[chip.providerId];
  switch (chip.state) {
    case 'normal':
      return usedLine({ chip });
    case 'warning':
      return `${label} is about to run out`;
    case 'out': {
      const scope = chip.window?.kind === 'fiveHour' || chip.window === null ? '' : ' for the week';
      const back = chip.resetsAt === null ? '' : ` Back ${backAt({ iso: chip.resetsAt, nowMs })}`;
      return `${label} is out${scope}.${back}`;
    }
    case 'stale':
      return chip.observedAt === null
        ? usedLine({ chip })
        : `Updated ${formatRelativeAge({ fromIso: chip.observedAt, nowMs })}`;
    case 'reset':
      return chip.resetsAt === null
        ? `The window reset. No ${label} turn since.`
        : `Reset at ${formatLimitReset({ iso: chip.resetsAt, nowMs })}. No ${label} turn since.`;
    case 'waiting':
      return `${label} shares its limits during a turn. Start a ${label} agent to see them.`;
    case 'none':
      return `${label} doesn't report its limits to Goodboy.`;
    default: {
      const exhaustive: never = chip.state;
      return exhaustive;
    }
  }
};
