import { useCallback, useEffect } from 'react';
import type { PullRequestFailureKind } from '@goodboy/core';
import type { MountId, PullRequestView, SessionId } from '@goodboy/types';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import { useAppStore } from '../../../../store';
import { entryMountIdOf } from '../../../../store/slices/pull-request-view/entryMountId';
import { sessionPullRequestOf } from '../../../../store/slices/review-source/sessionPullRequestOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly isEnabled: boolean;
  readonly fallbackNumber?: number | null;
};

const NO_EDITS: ReadonlyArray<PullRequestEdit> = [];

export type PullRequestViewRead = {
  readonly view: PullRequestView | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly errorKind: PullRequestFailureKind | null;
  readonly edits: ReadonlyArray<PullRequestEdit>;
  readonly reload: () => void;
};

export const usePullRequestView = ({
  sessionId,
  mountId: displayedMountId = null,
  isEnabled,
  fallbackNumber = null,
}: Params): PullRequestViewRead => {
  const entry = useAppStore((state) => state.pullRequestViews[sessionId] ?? null);
  const load = useAppStore((state) => state.loadPullRequestView);
  const hostNumber = useAppStore(
    (state) =>
      sessionPullRequestOf({ state, sessionId, mountId: displayedMountId })?.number ?? null,
  );
  const prNumber = hostNumber ?? fallbackNumber;
  const mountId = useAppStore((state) =>
    entryMountIdOf({ state, sessionId, mountId: displayedMountId ?? undefined }),
  );

  useEffect(() => {
    if (!isEnabled || prNumber === null) {
      return;
    }
    void load({ sessionId, ...(displayedMountId === null ? {} : { mountId: displayedMountId }) });
  }, [displayedMountId, isEnabled, load, mountId, prNumber, sessionId]);

  const reload = useCallback(() => {
    void load({
      sessionId,
      ...(displayedMountId === null ? {} : { mountId: displayedMountId }),
      force: true,
    });
  }, [displayedMountId, load, sessionId]);

  const isCurrent = entry !== null && entry.prNumber === prNumber && entry.mountId === mountId;
  return {
    view: isCurrent ? entry.view : null,
    isLoading: isCurrent && entry.isLoading,
    error: isCurrent ? entry.error : null,
    errorKind: isCurrent ? (entry.errorKind ?? null) : null,
    edits: isCurrent ? entry.edits : NO_EDITS,
    reload,
  };
};
