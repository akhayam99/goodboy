import type { PullRequestState } from '@goodboy/types';

const SUFFIX_OF_LAST_DIGIT: Readonly<Record<number, string>> = { 1: 'st', 2: 'nd', 3: 'rd' };

const FIRST_TEEN = 11;
const LAST_TEEN = 13;

type OrdinalParams = {
  readonly n: number;
};

export const ordinalOf = ({ n }: OrdinalParams): string => {
  const hundred = n % 100;
  const isTeen = hundred >= FIRST_TEEN && hundred <= LAST_TEEN;
  return `${n}${isTeen ? 'th' : (SUFFIX_OF_LAST_DIGIT[n % 10] ?? 'th')}`;
};

type Params = {
  readonly pr: Pick<PullRequestState, 'state' | 'mergeQueue' | 'isAutoMerge'>;
};

export const queueLineOf = ({ pr }: Params): string | null => {
  if (pr.state !== 'queued') {
    return null;
  }
  const position = pr.mergeQueue?.position ?? null;
  if (position !== null) {
    return `Queued to merge, ${ordinalOf({ n: position })} in line`;
  }
  if (pr.isAutoMerge === true) {
    return 'Merges when checks pass';
  }
  return 'Queued to merge';
};
