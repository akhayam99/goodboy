import { APP_LOCALE } from '../../../shared/utils/appLocale';

type Params = {
  readonly iso: string;
  readonly nowMs: number;
};

const isSameDay = ({ iso, nowMs }: Params): boolean =>
  new Date(iso).toDateString() === new Date(nowMs).toDateString();

const clock = ({ iso }: Pick<Params, 'iso'>): string =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const weekday = ({ iso }: Pick<Params, 'iso'>): string =>
  new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short' }).format(new Date(iso));

export const formatLimitReset = ({ iso, nowMs }: Params): string => {
  if (Number.isNaN(Date.parse(iso))) {
    return '';
  }
  if (isSameDay({ iso, nowMs })) {
    return clock({ iso });
  }
  return `${weekday({ iso })} ${clock({ iso })}`;
};

export const formatLimitResetShort = ({ iso, nowMs }: Params): string => {
  if (Number.isNaN(Date.parse(iso))) {
    return '';
  }
  return isSameDay({ iso, nowMs }) ? clock({ iso }) : weekday({ iso });
};

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const formatTimeUntil = ({ iso, nowMs }: Params): string => {
  const delta = Date.parse(iso) - nowMs;
  if (Number.isNaN(delta) || delta <= 0) {
    return '';
  }
  if (delta >= 2 * MS_PER_DAY) {
    return `in ${Math.round(delta / MS_PER_DAY)} days`;
  }
  const hours = Math.floor(delta / MS_PER_HOUR);
  const minutes = Math.max(1, Math.round((delta % MS_PER_HOUR) / MS_PER_MINUTE));
  if (hours === 0) {
    return `in ${minutes}m`;
  }
  return minutes === 60 ? `in ${hours + 1}h` : `in ${hours}h ${minutes}m`;
};
