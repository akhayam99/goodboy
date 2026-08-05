import { formatAbsoluteDate } from '../../shared/utils/formatAbsoluteDate';
import { formatAdaptiveAge } from '../../shared/utils/relativeDate';

type Params = {
  readonly iso: string;
  readonly style: 'short' | 'full';
};

export const formatReleaseDate = ({ iso, style }: Params): string => {
  if (style === 'short') {
    return formatAdaptiveAge({ iso });
  }
  return formatAbsoluteDate({ iso });
};
