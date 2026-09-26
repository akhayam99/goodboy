import type { ResetAdvice } from '@goodboy/core';
import { APP_LOCALE } from '../../../../../../../shared/utils/appLocale';
import { formatLimitReset, formatTimeUntil } from '../../../../../limits/formatLimitReset';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const formatResetDate = (iso: string): string => {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${day} ${time}`;
};

export const nextWeeklyRefillAfterReset = ({ nowMs }: { readonly nowMs: number }): string =>
  formatResetDate(new Date(nowMs + WEEK_MS).toISOString());

export const expiryLine = ({ expiresAt }: { readonly expiresAt: string | null }): string => {
  const base = 'Puts the 5-hour window and the week back to 0%.';
  if (expiresAt === null) {
    return base;
  }
  const day = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short', day: 'numeric' }).format(
    new Date(expiresAt),
  );
  return `${base} Expires ${day}.`;
};

export const countLabel = ({ count }: { readonly count: number }): string =>
  count === 1 ? '1 free reset' : `${count} free resets`;

type AdviceParams = {
  readonly advice: ResetAdvice;
  readonly nowMs: number;
};

export const nowSummary = ({ advice }: Pick<AdviceParams, 'advice'>): string =>
  `5h ${advice.fiveHourUsedPercent ?? 0}% · week ${advice.weekUsedPercent}%`;

export const normalBody = ({ advice, nowMs }: AdviceParams): string => {
  const next = nextWeeklyRefillAfterReset({ nowMs });
  if (advice.weeklyRefillAt === null) {
    return `Your week restarts now and next refills ${next}. You can't undo this.`;
  }
  const due = formatLimitReset({ iso: advice.weeklyRefillAt, nowMs });
  return `Your week restarts now, so the refill due ${due} moves to ${next}. You can't undo this.`;
};

export const strongTitle = ({ advice, nowMs }: AdviceParams): string => {
  if (advice.weekLeftPercent >= 50 || advice.weeklyRefillAt === null) {
    return `You still have ${advice.weekLeftPercent}% of this week left`;
  }
  return `Your week refills by itself ${formatLimitReset({ iso: advice.weeklyRefillAt, nowMs })}`;
};

export const strongBody = ({ advice, nowMs }: AdviceParams): string => {
  const tail = `A reset now gives back just the ${advice.weekUsedPercent}% of the week you used, and it can't be undone. It's worth most in a week that runs out early.`;
  if (!advice.isOnlyFiveHourFull || advice.fiveHourFreesAt === null) {
    return tail;
  }
  const at = formatLimitReset({ iso: advice.fiveHourFreesAt, nowMs });
  const until = formatTimeUntil({ iso: advice.fiveHourFreesAt, nowMs });
  const when = until === '' ? at : `${at}, ${until},`;
  return `Only the 5-hour window is full, and it frees itself at ${when} without a reset. ${tail}`;
};

export const strongConsent = ({
  advice,
  count,
}: {
  readonly advice: ResetAdvice;
  readonly count: number;
}): string =>
  `I understand I'm spending ${count === 1 ? 'my only reset' : 'a reset'} with ${advice.weekLeftPercent}% of the week left.`;
