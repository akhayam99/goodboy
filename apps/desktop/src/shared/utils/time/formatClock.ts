import { formatIntl } from './formatIntl';

type Params = {
  readonly at: string | number;
};

export const formatClock = ({ at }: Params): string =>
  formatIntl({ at, options: { hour: '2-digit', minute: '2-digit' } });
