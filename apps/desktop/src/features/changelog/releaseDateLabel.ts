import { formatDayMonth } from '../../shared/utils/time/formatDayMonth';

type Params = {
  readonly publishedAt: string | undefined;
};

export const releaseDateLabel = ({ publishedAt }: Params): string | null => {
  if (publishedAt === undefined || Number.isNaN(Date.parse(publishedAt))) {
    return null;
  }
  return formatDayMonth({ at: publishedAt });
};
