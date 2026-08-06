import { APP_LOCALE } from './appLocale';
import { toValidDate } from './toValidDate';

export const formatRelativeDuration = (fromIso: string, toIso?: string): string => {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) {
    return '';
  }
  const toMs = toIso ? Date.parse(toIso) : Date.now();
  if (Number.isNaN(toMs)) {
    return '';
  }
  const diff = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (diff < 60) {
    return `${diff}s`;
  }
  const m = Math.floor(diff / 60);
  if (m < 60) {
    return `${m}m`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    return `${h}h`;
  }
  const d = Math.floor(h / 24);
  return `${d}d`;
};

type AbsoluteDateTimeParams = {
  readonly iso: string;
  readonly locale?: Intl.LocalesArgument;
};

export const formatAbsoluteDateTime = ({
  iso,
  locale = APP_LOCALE,
}: AbsoluteDateTimeParams): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
};

type FormatRelativeAgeParams = {
  readonly fromIso: string;
  readonly nowMs?: number;
};

export const formatRelativeAge = ({ fromIso, nowMs }: FormatRelativeAgeParams): string => {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) {
    return '';
  }
  const toMs = nowMs ?? Date.now();
  const seconds = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (seconds < 60) {
    return 'just now';
  }
  return `${formatRelativeDuration(fromIso, new Date(toMs).toISOString())} ago`;
};

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

type CalendarDayParams = {
  readonly date: Date;
};

const startOfCalendarDay = ({ date }: CalendarDayParams): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

type DayMonthParams = {
  readonly date: Date;
  readonly withYear: boolean;
};

const dayFirstDate = ({ date, withYear }: DayMonthParams): string => {
  const parts = new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    ...(withYear && { year: 'numeric' }),
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const year = withYear ? ` ${valueOf('year')}` : '';
  return `${valueOf('day')} ${valueOf('month').toLowerCase()}${year}`;
};

type FormatAdaptiveAgeParams = {
  readonly iso: string | number;
  readonly nowMs?: number;
};

export const formatAdaptiveAge = ({ iso, nowMs }: FormatAdaptiveAgeParams): string => {
  const date = toValidDate({ iso });
  if (date == null) {
    return '';
  }
  const now = new Date(nowMs ?? Date.now());
  const dayGap = Math.round(
    (startOfCalendarDay({ date: now }) - startOfCalendarDay({ date })) / MS_PER_DAY,
  );
  if (dayGap <= 0) {
    const elapsed = Math.max(0, now.getTime() - date.getTime());
    if (elapsed < MS_PER_MINUTE) {
      return 'just now';
    }
    if (elapsed < MS_PER_HOUR) {
      return `${Math.floor(elapsed / MS_PER_MINUTE)}m ago`;
    }
    return `${Math.floor(elapsed / MS_PER_HOUR)}h ago`;
  }
  if (dayGap === 1) {
    return 'yesterday';
  }
  return dayFirstDate({ date, withYear: date.getFullYear() !== now.getFullYear() });
};
