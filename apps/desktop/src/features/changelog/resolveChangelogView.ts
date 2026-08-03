import type { ChangelogStatus } from '../../store/slices/changelog/state';

export type ChangelogView = 'loading' | 'failed' | 'empty' | 'ready';

type Params = {
  readonly status: ChangelogStatus;
  readonly releaseCount: number;
};

export const resolveChangelogView = ({ status, releaseCount }: Params): ChangelogView => {
  if (releaseCount > 0) {
    return 'ready';
  }
  if (status === 'error') {
    return 'failed';
  }
  if (status === 'ready') {
    return 'empty';
  }
  return 'loading';
};
