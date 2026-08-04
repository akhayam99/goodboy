export const APP_LOCALE = 'en-US';

type DateFormatParams = {
  readonly iso: string | number;
};

const toValidDate = (iso: string | number): Date | null => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

export const formatAbsoluteDate = ({ iso }: DateFormatParams): string => {
  const date = toValidDate(iso);
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const formatShortDate = ({ iso }: DateFormatParams): string => {
  const date = toValidDate(iso);
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatShortDayMonth = ({ iso }: DateFormatParams): string => {
  const date = toValidDate(iso);
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

export const formatWeekday = ({ iso }: DateFormatParams): string => {
  const date = toValidDate(iso);
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long' }).format(date);
};

export const formatClockTime = ({ iso }: DateFormatParams): string => {
  const date = toValidDate(iso);
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

export const formatCompactDateTime = ({ iso }: DateFormatParams): string => {
  const date = toValidDate(iso);
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatInteger = (value: number): string => value.toLocaleString(APP_LOCALE);
