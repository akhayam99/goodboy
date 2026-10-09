import { useCallback, useRef, useState } from 'react';
import { inlineMarkdownText } from '@goodboy/ui';
import type { PullRequestState, WorkspaceId } from '@goodboy/types';
import { useQuietFollowToast } from '../../../shared/hooks/useFollowToast';
import { useAppStore } from '../../../store';
import { branchPlace } from '../../../store/slices/navigation/place';
import type { SessionDraftMount } from '../../../store/slices/sessionDraft/startSessionFromDraft';
import { branchLandingTabOf } from '../../branch/branchLandingTab';
import { goalFromPullRequest } from '../../integrations/github/goal-from-pull-request';
import { githubPullRequestCandidate } from '../../integrations/issueCandidateOf';
import type { LaunchMount } from '../launchMountFor';

const REVIEW_STARTED_TITLE = 'Review started';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly mount: LaunchMount | null;
};

type Result = {
  readonly start: (params: { readonly pr: PullRequestState }) => Promise<boolean>;
  readonly isStarting: boolean;
};

export const usePullRequestReviewStart = ({ workspaceId, mount }: Params): Result => {
  const startSessionFromDraft = useAppStore((state) => state.startSessionFromDraft);
  const navigate = useAppStore((state) => state.navigate);
  const reportError = useAppStore((state) => state.reportError);
  const followReview = useQuietFollowToast();
  const [isStarting, setIsStarting] = useState(false);
  const busyRef = useRef(false);

  const start = useCallback(
    async ({ pr }: { readonly pr: PullRequestState }): Promise<boolean> => {
      if (busyRef.current) {
        return false;
      }
      busyRef.current = true;
      setIsStarting(true);
      try {
        const candidate = githubPullRequestCandidate(pr);
        const draftMount: SessionDraftMount | null =
          mount === null ? null : { projectId: mount.selectedId, reason: mount.reason };
        const session = await startSessionFromDraft({
          workspaceId,
          start: {
            kind: 'task',
            candidate,
            title: `Review ${candidate.identifier}: ${pr.title}`,
            goal: goalFromPullRequest({ pr }),
            then: { kind: 'agent', agentKind: 'pr-reviewer', prompt: '', routing: null },
            checkout: { existingBranch: pr.headBranch, fallbackRef: `pull/${pr.number}/head` },
            ...(draftMount !== null && { mount: draftMount }),
          },
        });
        const place = branchPlace({
          sessionId: session.id,
          tab: branchLandingTabOf({ hasPullRequest: true, deepLink: 'pr' }),
        });
        navigate({ to: place });
        followReview({
          title: REVIEW_STARTED_TITLE,
          message: inlineMarkdownText({ text: pr.title }),
          target: { place },
          startKey: session.id,
        });
        return true;
      } catch (error: unknown) {
        void reportError({ title: "Couldn't start the review", error });
        return false;
      } finally {
        busyRef.current = false;
        setIsStarting(false);
      }
    },
    [followReview, mount, navigate, reportError, startSessionFromDraft, workspaceId],
  );

  return { start, isStarting };
};
