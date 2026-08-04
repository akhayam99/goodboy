import { APP_LOCALE } from './appLocale';
import { toValidDate } from './toValidDate';

type Params = {
  readonly iso: string | number;
};

export const formatShortDayMonth = ({ iso }: Params): string => {
  const date = toValidDate({ iso });
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
  }).format(date);
};
