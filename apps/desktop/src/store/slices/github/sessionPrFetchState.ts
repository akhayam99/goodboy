import type { IsoDateTime, SessionPrFetchState } from '@goodboy/types';

type Params = {
  readonly githubAvailable: boolean | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly failedAt: IsoDateTime | null;
  readonly fetchable: boolean;
};

export const sessionPrFetchState = ({
  githubAvailable,
  fetchedAt,
  failedAt,
  fetchable,
}: Params): SessionPrFetchState => {
  if (failedAt !== null && (fetchedAt === null || failedAt > fetchedAt)) {
    return 'unreachable';
  }
  if (fetchedAt !== null) {
    return 'known';
  }
  if (githubAvailable === false) {
    return 'known';
  }
  if (!fetchable) {
    return 'known';
  }
  return 'unknown';
};
