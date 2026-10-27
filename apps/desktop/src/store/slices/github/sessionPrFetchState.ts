import type { IsoDateTime, SessionPrFetchState } from '@goodboy/types';

type Params = {
  readonly isHostAvailable: boolean | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly failedAt: IsoDateTime | null;
};

export const sessionPrFetchState = ({
  isHostAvailable,
  fetchedAt,
  failedAt,
}: Params): SessionPrFetchState => {
  if (failedAt !== null && (fetchedAt === null || failedAt > fetchedAt)) {
    return 'unreachable';
  }
  if (fetchedAt !== null) {
    return 'known';
  }
  if (isHostAvailable === false) {
    return 'known';
  }
  return 'unknown';
};
