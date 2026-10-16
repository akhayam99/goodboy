import { formatSpan } from '../../../shared/utils/time/formatSpan';

type Params = {
  readonly lastActivityAt: number;
  readonly now: number;
};

export const inactiveWords = ({ lastActivityAt, now }: Params): string =>
  `inactive ${formatSpan({ from: lastActivityAt, to: now })}`;
