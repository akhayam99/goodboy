import { formatSpan } from '../../../shared/utils/time/formatSpan';

type Params = {
  readonly since: number | null;
  readonly now: number;
};

export const waitingTextOf = ({ since, now }: Params): string | null => {
  if (since === null) {
    return null;
  }
  const span = formatSpan({ from: since, to: now });
  return span === '' ? null : `Waiting ${span}`;
};
