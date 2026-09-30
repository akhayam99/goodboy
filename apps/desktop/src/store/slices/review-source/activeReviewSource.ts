import type { SessionId } from '@goodboy/types';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import type { AppState } from '../../types';
import { selectActiveMountId } from '../project-mounts/selectors';
import { openBitbucketPullRequestsOf, reviewSourceEntriesOf } from './reviewSourceEntries';
import { LOCAL_SOURCE_KEY, type ActiveReviewSource, type ReviewSourceEntry } from './types';

export type ReviewSourceSelectionState = Parameters<typeof reviewSourceEntriesOf>[0]['state'] &
  Pick<AppState, 'sessionActiveMount' | 'reviewSourceKeys' | 'sessionBitbucketPr'>;

type Params = {
  readonly state: ReviewSourceSelectionState;
  readonly sessionId: SessionId;
};

const GITHUB_REPO = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\/\d+/;
const GITLAB_PROJECT = /^https?:\/\/[^/]+\/(.+?)\/-\/merge_requests\/\d+/;

const isOnActiveMount = ({
  entry,
  activeMountId,
}: {
  readonly entry: ReviewSourceEntry;
  readonly activeMountId: string | null;
}): boolean => entry.mountId === null || entry.mountId === activeMountId;

export const selectedReviewEntryOf = ({ state, sessionId }: Params): ReviewSourceEntry => {
  const entries = reviewSourceEntriesOf({ state, sessionId });
  const activeMountId = selectActiveMountId({ state, sessionId });
  const key = state.reviewSourceKeys?.[sessionId] ?? null;
  const picked = entries.find(
    (entry) =>
      entry.key === key && (entry.kind === 'local' || isOnActiveMount({ entry, activeMountId })),
  );
  if (picked !== undefined) {
    return picked;
  }
  const github = state.sessionGithub?.[sessionId]?.pr ?? null;
  const gitlab = state.sessionGitlabMr?.[sessionId]?.mr ?? null;
  const bitbucket = state.sessionBitbucketPr?.[sessionId]?.pr ?? null;
  const remote = entries.filter((entry) => entry.kind !== 'local');
  const onActive = remote.filter((entry) => isOnActiveMount({ entry, activeMountId }));
  return (
    onActive.find((entry) => entry.kind === 'github' && entry.number === github?.number) ??
    onActive.find((entry) => entry.kind === 'gitlab' && entry.number === gitlab?.iid) ??
    onActive.find((entry) => entry.kind === 'bitbucket' && entry.number === bitbucket?.id) ??
    onActive[0] ??
    remote[0] ??
    entries.find((entry) => entry.key === LOCAL_SOURCE_KEY) ?? {
      key: LOCAL_SOURCE_KEY,
      kind: 'local',
      mountId: null,
      projectId: null,
      number: null,
      label: '',
      url: null,
      openCount: null,
    }
  );
};

export const activeReviewSourceOf = ({ state, sessionId }: Params): ActiveReviewSource | null => {
  const entry = selectedReviewEntryOf({ state, sessionId });
  if (entry.kind === 'github' && entry.number !== null) {
    const github = state.sessionGithub?.[sessionId] ?? null;
    const pr = github?.pr ?? null;
    const isDisplayed = pr !== null && pr.number === entry.number;
    return {
      kind: 'github',
      entry,
      mountId: entry.mountId,
      projectId: entry.projectId,
      prNumber: entry.number,
      url: entry.url,
      repo: GITHUB_REPO.exec(entry.url ?? '')?.[1] ?? null,
      headBranch: isDisplayed ? pr.headBranch : null,
      comments: isDisplayed ? (github?.detail?.comments ?? []) : [],
      hasDetail: isDisplayed && github?.detail != null,
      isLoading: !isDisplayed || github?.detailLoading === true,
      error: isDisplayed ? (github?.detailError ?? null) : null,
      fetchedAt: isDisplayed ? (github?.detailFetchedAt ?? null) : null,
      capabilities: REVIEW_SOURCE_CAPABILITIES.github,
    };
  }
  if (entry.kind === 'gitlab' && entry.number !== null) {
    const mr = state.sessionGitlabMr?.[sessionId]?.mr ?? null;
    const threads =
      entry.url === null ? undefined : state.reviewSourceThreads?.[sessionId]?.[entry.url];
    return {
      kind: 'gitlab',
      entry,
      mountId: entry.mountId,
      projectId: entry.projectId,
      prNumber: entry.number,
      url: entry.url,
      repo: GITLAB_PROJECT.exec(entry.url ?? '')?.[1] ?? null,
      headBranch: mr !== null && mr.iid === entry.number ? mr.sourceBranch : null,
      comments: threads?.comments ?? [],
      hasDetail: threads !== undefined && threads.fetchedAt !== null,
      isLoading: threads === undefined || threads.loading,
      error: threads?.error ?? null,
      fetchedAt: threads?.fetchedAt ?? null,
      capabilities: REVIEW_SOURCE_CAPABILITIES.gitlab,
    };
  }
  if (entry.kind === 'bitbucket' && entry.number !== null) {
    const mountBitbucket =
      entry.mountId === null ? undefined : state.mountBitbucketPr?.[entry.mountId];
    const pr =
      mountBitbucket === undefined
        ? null
        : (openBitbucketPullRequestsOf({ bitbucket: mountBitbucket }).find(
            (candidate) => candidate.id === entry.number,
          ) ?? null);
    const threads = state.reviewSourceThreads?.[sessionId]?.[entry.url ?? entry.key];
    return {
      kind: 'bitbucket',
      entry,
      mountId: entry.mountId,
      projectId: entry.projectId,
      prNumber: entry.number,
      url: entry.url,
      repo: mountBitbucket?.repository ?? null,
      headBranch: pr?.sourceBranch ?? null,
      comments: threads?.comments ?? [],
      hasDetail: threads !== undefined && threads.fetchedAt !== null,
      isLoading: threads === undefined || threads.loading,
      error: threads?.error ?? null,
      fetchedAt: threads?.fetchedAt ?? null,
      capabilities: REVIEW_SOURCE_CAPABILITIES.bitbucket,
    };
  }
  return null;
};
