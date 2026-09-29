import { formatIntl } from './formatIntl';

type Params = {
  readonly at: string | number;
};

export const formatDayMonth = ({ at }: Params): string =>
  formatIntl({ at, options: { month: 'short', day: 'numeric' } });
