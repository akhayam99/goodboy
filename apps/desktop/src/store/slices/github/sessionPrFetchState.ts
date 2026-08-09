import type { IsoDateTime, SessionPrFetchState } from '@goodboy/types';

type Params = {
  readonly githubAvailable: boolean | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly failedAt: IsoDateTime | null;
};

export const sessionPrFetchState = ({
  githubAvailable,
  fetchedAt,
  failedAt,
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
  return 'unknown';
};
