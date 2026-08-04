import { formatAbsoluteDate } from '../../shared/utils/formatAbsoluteDate';
import { formatShortDayMonth } from '../../shared/utils/formatShortDayMonth';

type Params = {
  readonly iso: string;
  readonly style: 'short' | 'full';
};

export const formatReleaseDate = ({ iso, style }: Params): string => {
  if (style === 'short') {
    return formatShortDayMonth({ iso });
  }
  return formatAbsoluteDate({ iso });
};
