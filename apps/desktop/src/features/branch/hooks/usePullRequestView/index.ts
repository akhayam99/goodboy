import { useCallback, useEffect } from 'react';
import type { PullRequestView, SessionId } from '@goodboy/types';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import { useAppStore } from '../../../../store';
import { entryMountIdOf } from '../../../../store/slices/pull-request-view/entryMountId';

type Params = {
  readonly sessionId: SessionId;
  readonly isEnabled: boolean;
  readonly fallbackNumber?: number | null;
};

const NO_EDITS: ReadonlyArray<PullRequestEdit> = [];

export type PullRequestViewRead = {
  readonly view: PullRequestView | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly edits: ReadonlyArray<PullRequestEdit>;
  readonly reload: () => void;
};

export const usePullRequestView = ({
  sessionId,
  isEnabled,
  fallbackNumber = null,
}: Params): PullRequestViewRead => {
  const entry = useAppStore((state) => state.pullRequestViews[sessionId] ?? null);
  const load = useAppStore((state) => state.loadPullRequestView);
  const githubNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const prNumber = githubNumber ?? fallbackNumber;
  const mountId = useAppStore((state) => entryMountIdOf({ state, sessionId }));

  useEffect(() => {
    if (!isEnabled || prNumber === null) {
      return;
    }
    void load({ sessionId });
  }, [isEnabled, load, mountId, prNumber, sessionId]);

  const reload = useCallback(() => {
    void load({ sessionId, force: true });
  }, [load, sessionId]);

  const isCurrent = entry !== null && entry.prNumber === prNumber && entry.mountId === mountId;
  return {
    view: isCurrent ? entry.view : null,
    isLoading: isCurrent && entry.isLoading,
    error: isCurrent ? entry.error : null,
    edits: isCurrent ? entry.edits : NO_EDITS,
    reload,
  };
};
