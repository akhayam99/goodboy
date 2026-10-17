import { formatAge } from '../../../shared/utils/time/formatAge';

type Params = {
  readonly lastActivityAt: number;
  readonly now: number;
};

export const inactiveWords = ({ lastActivityAt, now }: Params): string =>
  formatAge({ from: lastActivityAt, now });
