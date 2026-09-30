import { formatIntl } from './formatIntl';

type Params = {
  readonly at: string | number;
  readonly hasYear?: boolean;
};

export const formatDateTime = ({ at, hasYear = false }: Params): string =>
  formatIntl({
    at,
    options: {
      month: 'short',
      day: 'numeric',
      ...(hasYear && { year: 'numeric' }),
      hour: '2-digit',
      minute: '2-digit',
    },
  });
