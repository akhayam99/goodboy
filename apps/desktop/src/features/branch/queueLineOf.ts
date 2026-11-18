import type { PullRequestState } from '@goodboy/types';
import { ordinalOf } from '../../shared/utils/ordinalOf';

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
