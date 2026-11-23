import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core/review-source';
import type { MountId, PrComment, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectedReviewEntryOf } from '../../../../../store/slices/review-source/activeReviewSource';
import { checksViewOf, type ChecksHostKind } from '../../../../branch/checksViewOf';
import { usePullRequestView } from '../../../../branch/hooks/usePullRequestView';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export type DeskPrRequest = {
  readonly number: number;
  readonly title: string;
  readonly url: string;
};

export type DeskPrComments =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly error: string | null }
  | { readonly kind: 'host' }
  | { readonly kind: 'ready'; readonly comments: ReadonlyArray<PrComment> };

export type DeskPrSource = {
  readonly host: ChecksHostKind;
  readonly request: DeskPrRequest | null;
  readonly branch: string | null;
  readonly checks: ReturnType<typeof checksViewOf>;
  readonly comments: DeskPrComments;
  readonly isChecking: boolean;
  readonly retry: () => void;
};

export const useDeskPrSource = ({ sessionId, mountId }: Params): DeskPrSource => {
  const github = useAppStore((state) => state.mountGithub[mountId] ?? null);
  const refreshSessionPrDetail = useAppStore((state) => state.refreshSessionPrDetail);
  const host = useAppStore(
    useShallow((state) => {
      const entry = selectedReviewEntryOf({ state, sessionId, mountId });
      const kind: ChecksHostKind = entry?.kind ?? 'local';
      return { kind, url: entry?.url ?? null, number: entry?.number ?? null };
    }),
  );
  const threads = useAppStore((state) =>
    host.url === null ? null : (state.reviewSourceThreads[sessionId]?.[host.url] ?? null),
  );
  const canReadChecks = REVIEW_SOURCE_CAPABILITIES[host.kind].canReadChecks;
  const isPortHost = host.kind === 'gitlab' || host.kind === 'bitbucket';
  const portView = usePullRequestView({
    sessionId,
    mountId,
    isEnabled: isPortHost && canReadChecks,
    fallbackNumber: host.number,
  });

  const pr = github?.pr ?? null;
  const detail = github?.detail ?? null;
  const prNumber = pr?.number ?? null;
  const hasDetail = detail !== null && detail.prNumber === prNumber;
  const isDetailLoading = github?.detailLoading === true;
  const detailError = github?.detailError ?? null;
  const hasFetchedDetail = (github?.detailFetchedAt ?? null) !== null;

  useEffect(() => {
    if (isPortHost || prNumber === null || hasDetail) {
      return;
    }
    void refreshSessionPrDetail(sessionId, { mountId });
  }, [hasDetail, isPortHost, mountId, prNumber, refreshSessionPrDetail, sessionId]);

  const reloadPortView = portView.reload;
  const retry = useCallback(() => {
    if (isPortHost) {
      reloadPortView();
      return;
    }
    void refreshSessionPrDetail(sessionId, { force: true, mountId });
  }, [isPortHost, mountId, refreshSessionPrDetail, reloadPortView, sessionId]);

  const isChecking = isPortHost ? portView.isLoading : isDetailLoading;
  const checks = checksViewOf({
    hostKind: host.kind,
    hostUrl: host.url,
    pr,
    detail,
    isDetailLoading,
    detailError,
    hasFetchedDetail,
    canReadChecks,
    portChecks: portView.view?.checks ?? null,
    portReadFailure:
      portView.isLoading || portView.view !== null || portView.error === null
        ? null
        : { kind: portView.errorKind === 'denied' ? 'denied' : 'failed', error: portView.error },
  });

  if (isPortHost) {
    const number = portView.view?.number ?? host.number;
    return {
      host: host.kind,
      request:
        number === null
          ? null
          : {
              number,
              title: portView.view?.title ?? '',
              url: portView.view?.url ?? host.url ?? '',
            },
      branch: portView.view?.headBranch ?? github?.branch ?? null,
      checks,
      comments:
        threads === null || threads.fetchedAt === null
          ? { kind: 'host' }
          : { kind: 'ready', comments: threads.comments },
      isChecking,
      retry,
    };
  }

  const comments = (): DeskPrComments => {
    if (!isDetailLoading && detailError !== null) {
      return { kind: 'failed', error: detailError };
    }
    if (detail === null || !hasDetail) {
      return !isDetailLoading && hasFetchedDetail
        ? { kind: 'failed', error: null }
        : { kind: 'loading' };
    }
    return { kind: 'ready', comments: detail.comments };
  };

  return {
    host: host.kind,
    request: pr === null ? null : { number: pr.number, title: pr.title, url: pr.url },
    branch: github?.branch ?? null,
    checks,
    comments: comments(),
    isChecking,
    retry,
  };
};
