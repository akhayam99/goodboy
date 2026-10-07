import type { PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';

export type ChecksHost = 'gitlab' | 'bitbucket';

type ChecksView =
  | { readonly kind: 'host'; readonly host: ChecksHost; readonly url: string | null }
  | { readonly kind: 'no-pr' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'denied'; readonly error: string | null }
  | { readonly kind: 'failed'; readonly error: string | null }
  | { readonly kind: 'ready'; readonly checks: ReadonlyArray<PrCheckRun> };

type Params = {
  readonly hostKind: 'github' | 'gitlab' | 'bitbucket' | 'local';
  readonly hostUrl: string | null;
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
  readonly isDetailLoading: boolean;
  readonly detailError: string | null;
  readonly hasFetchedDetail: boolean;
};

export const checksViewOf = ({
  hostKind,
  hostUrl,
  pr,
  detail,
  isDetailLoading,
  detailError,
  hasFetchedDetail,
}: Params): ChecksView => {
  if (hostKind === 'gitlab' || hostKind === 'bitbucket') {
    return { kind: 'host', host: hostKind, url: hostUrl };
  }
  if (pr === null) {
    return { kind: 'no-pr' };
  }
  if (!isDetailLoading && detailError !== null) {
    return { kind: 'failed', error: detailError };
  }
  if (detail === null) {
    return !isDetailLoading && hasFetchedDetail
      ? { kind: 'failed', error: null }
      : { kind: 'loading' };
  }
  if (detail.prNumber !== pr.number) {
    return { kind: 'loading' };
  }
  const read = detail.checksRead ?? 'ok';
  if (read === 'denied') {
    return { kind: 'denied', error: detail.checksError ?? null };
  }
  if (read === 'failed') {
    return { kind: 'failed', error: detail.checksError ?? null };
  }
  return { kind: 'ready', checks: detail.checks };
};
