import type { PrCheckRun, PrDetail, PullRequestChecksView, PullRequestState } from '@goodboy/types';

export type ChecksHost = 'gitlab' | 'bitbucket';

export type ChecksHostKind = 'github' | ChecksHost | 'local';

type ChecksView =
  | { readonly kind: 'host'; readonly host: ChecksHost; readonly url: string | null }
  | { readonly kind: 'no-pr' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'denied'; readonly error: string | null }
  | { readonly kind: 'failed'; readonly error: string | null }
  | { readonly kind: 'ready'; readonly checks: ReadonlyArray<PrCheckRun> };

type Params = {
  readonly hostKind: ChecksHostKind;
  readonly hostUrl: string | null;
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
  readonly isDetailLoading: boolean;
  readonly detailError: string | null;
  readonly hasFetchedDetail: boolean;
  readonly canReadChecks: boolean;
  readonly portChecks: PullRequestChecksView | null;
};

const portViewOf = ({
  host,
  url,
  portChecks,
}: {
  readonly host: ChecksHost;
  readonly url: string | null;
  readonly portChecks: PullRequestChecksView | null;
}): ChecksView => {
  if (portChecks === null) {
    return { kind: 'loading' };
  }
  if (portChecks.read === 'denied') {
    return { kind: 'denied', error: portChecks.error };
  }
  if (portChecks.read === 'failed') {
    return { kind: 'failed', error: portChecks.error };
  }
  if (portChecks.read === 'unsupported') {
    return { kind: 'host', host, url };
  }
  return { kind: 'ready', checks: portChecks.runs };
};

export const checksViewOf = ({
  hostKind,
  hostUrl,
  pr,
  detail,
  isDetailLoading,
  detailError,
  hasFetchedDetail,
  canReadChecks,
  portChecks,
}: Params): ChecksView => {
  if (hostKind === 'gitlab' || hostKind === 'bitbucket') {
    return canReadChecks
      ? portViewOf({ host: hostKind, url: hostUrl, portChecks })
      : { kind: 'host', host: hostKind, url: hostUrl };
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
