import { formatIntl } from './formatIntl';

type Params = {
  readonly at: string | number;
  readonly isShort?: boolean;
};

export const formatWeekday = ({ at, isShort = false }: Params): string =>
  formatIntl({ at, options: { weekday: isShort ? 'short' : 'long' } });
