import { formatSpan } from '../../shared/utils/time/formatSpan';

type Params = {
  readonly startedAt: number;
  readonly now: number;
};

export const formatUptime = ({ startedAt, now }: Params): string =>
  formatSpan({ from: startedAt, to: now });
