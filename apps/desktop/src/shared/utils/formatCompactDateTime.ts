import { APP_LOCALE } from './appLocale';
import { toValidDate } from './toValidDate';

type Params = {
  readonly iso: string | number;
};

export const formatCompactDateTime = ({ iso }: Params): string => {
  const date = toValidDate({ iso });
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
