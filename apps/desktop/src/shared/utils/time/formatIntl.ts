import { APP_LOCALE } from '../appLocale';

type Params = {
  readonly at: string | number;
  readonly options: Intl.DateTimeFormatOptions;
};

export const formatIntl = ({ at, options }: Params): string => {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(APP_LOCALE, { hourCycle: 'h23', ...options }).format(date);
};
