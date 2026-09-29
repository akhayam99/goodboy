import { formatSpan } from './formatSpan';

type Params = {
  readonly from: string | number | null;
  readonly now: number;
};

export const formatAge = ({ from, now }: Params): string => {
  const span = formatSpan({ from, to: now });
  if (span === '') {
    return '';
  }
  return span.endsWith('s') ? 'just now' : `${span} ago`;
};
