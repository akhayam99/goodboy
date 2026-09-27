import { APP_LOCALE } from '../../../../shared/utils/appLocale';
import { toValidDate } from '../../../../shared/utils/toValidDate';

type Params = {
  readonly iso: string | number;
};

export const formatPrintDate = ({ iso }: Params): string => {
  const date = toValidDate({ iso });
  if (date == null) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};
