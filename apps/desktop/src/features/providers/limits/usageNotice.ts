import type { LimitsChip } from '@goodboy/core';
import type { NoticeTone } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../providerLabel';
import { formatLimitReset } from './formatLimitReset';

export type UsageNotice = Readonly<{
  tone: NoticeTone;
  title: string;
  body: string | null;
}>;

type Params = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

const windowPhrase = ({ chip }: Pick<Params, 'chip'>): string =>
  chip.window?.kind === 'fiveHour' ? 'The 5-hour window' : 'The week';

export const usageNotice = ({ chip, nowMs }: Params): UsageNotice | null => {
  const label = PROVIDER_LABEL[chip.providerId];
  const reset = chip.resetsAt === null ? null : formatLimitReset({ iso: chip.resetsAt, nowMs });
  switch (chip.state) {
    case 'warning':
      return {
        tone: 'warning',
        title: `${label} is about to run out.`,
        body: reset === null ? null : `${windowPhrase({ chip })} resets at ${reset}.`,
      };
    case 'out':
      return {
        tone: 'danger',
        title:
          chip.window?.kind === 'fiveHour'
            ? `${label} is out for now.`
            : `${label} is out for the week.`,
        body: reset === null ? null : `It comes back ${reset}.`,
      };
    case 'waiting':
      return {
        tone: 'info',
        title: `${label} shares its limits during a turn.`,
        body: `Start a ${label} agent to see them.`,
      };
    case 'none':
      return { tone: 'info', title: `${label} doesn't report its limits to Goodboy.`, body: null };
    case 'reset':
      return {
        tone: 'info',
        title: `The window reset. No ${label} turn since.`,
        body: null,
      };
    case 'normal':
    case 'stale':
      return null;
    default: {
      const exhaustive: never = chip.state;
      return exhaustive;
    }
  }
};
