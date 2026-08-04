import { APP_LOCALE } from './appLocale';
import { toValidDate } from './toValidDate';

type Params = {
  readonly iso: string | number;
};

export const formatClockTime = ({ iso }: Params): string => {
  const date = toValidDate({ iso });
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};
