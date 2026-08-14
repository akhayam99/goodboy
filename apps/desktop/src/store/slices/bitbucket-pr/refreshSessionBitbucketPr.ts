import type { IsoDateTime, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  bitbucketGetPullRequest,
  bitbucketPullRequestForBranch,
} from '../../../features/integrations/bitbucket/client';
import { carryForward } from './state';
import { resolveBitbucketPrContext } from './resolveBitbucketPrContext';
import type { GetFn, SetFn } from './types';

export type RefreshSessionBitbucketPrOptions = {
  readonly force?: boolean;
  readonly silent?: boolean;
};

export const refreshSessionBitbucketPr = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: RefreshSessionBitbucketPrOptions) => {
    if (opts?.force !== true && get().sessionBitbucketPr[sessionId]?.loading === true) {
      return;
    }
    const context = await resolveBitbucketPrContext({ get, sessionId });
    if (context == null) {
      return;
    }
    const repo = {
      workspaceId: context.workspaceId,
      workspaceSlug: context.workspaceSlug,
      repoSlug: context.repoSlug,
      email: context.email,
    };
    set((state) => ({
      sessionBitbucketRepo: { ...state.sessionBitbucketRepo, [sessionId]: repo },
      sessionBitbucketPr: {
        ...state.sessionBitbucketPr,
        [sessionId]: {
          ...carryForward({ entry: state.sessionBitbucketPr[sessionId] }),
          loading: true,
        },
      },
    }));
    try {
      const selectedId = get().sessionSelectedBitbucketPrId[sessionId] ?? null;
      const pr =
        selectedId == null
          ? await bitbucketPullRequestForBranch({ ...repo, sourceBranch: context.branch })
          : await bitbucketGetPullRequest({ ...repo, pullRequestId: selectedId });
      set((state) => ({
        sessionBitbucketPr: {
          ...state.sessionBitbucketPr,
          [sessionId]: {
            pr,
            fetchedAt: new Date().toISOString() as IsoDateTime,
            loading: false,
            error: null,
          },
        },
      }));
    } catch (error) {
      set((state) => ({
        sessionBitbucketPr: {
          ...state.sessionBitbucketPr,
          [sessionId]: {
            ...carryForward({ entry: state.sessionBitbucketPr[sessionId] }),
            error: opts?.silent === true ? null : formatError(error),
          },
        },
      }));
    }
  };
};
