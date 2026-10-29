import type {
  BranchFactsCheck,
  BranchFactsPart,
  BranchFactsRequest,
  BranchFactsThread,
} from '@goodboy/core';
import { brandId, type MountId, type PrComment, type PullRequestView } from '@goodboy/types';
import type { CommitRangeParams, RangeCommit } from '../../../features/worktree/worktree';
import type { AppStore } from '../../store';
import { selectMountBaseBranch } from '../../slices/project-mounts/selectors';
import { pullRequestPortFor } from '../../slices/review-source/pullRequestPortFor';
import { refreshActiveRequest } from '../../slices/review-source/refreshActiveRequest';
import type { BranchFactsReaders, RequestFacts } from './branchFacts/readBranchFactsOf';

export type MakeBranchFactsReadersParams = Readonly<{
  getState: () => AppStore;
  commitRange: (params: CommitRangeParams) => Promise<ReadonlyArray<RangeCommit>>;
}>;

const NOT_OPEN_HERE = 'that request is not the one open in this conversation';

type RequestOfParams = {
  readonly view: PullRequestView;
};

const requestOf = ({ view }: RequestOfParams): BranchFactsRequest => ({
  host: view.host,
  number: view.number,
  title: view.title,
  url: view.url,
  state: view.state,
  isDraft: view.isDraft,
  baseBranch: view.baseBranch,
  headBranch: view.headBranch,
});

const checksOf = ({ view }: RequestOfParams): BranchFactsPart<ReadonlyArray<BranchFactsCheck>> =>
  view.checks.read === 'ok'
    ? {
        kind: 'ok',
        value: view.checks.runs.map((run) => ({ name: run.name, conclusion: run.conclusion })),
      }
    : {
        kind: 'unavailable',
        reason: view.checks.error ?? `the host answered ${view.checks.read}`,
      };

type OpenThreadsParams = {
  readonly comments: ReadonlyArray<PrComment>;
};

const openThreadsOf = ({ comments }: OpenThreadsParams): ReadonlyArray<BranchFactsThread> =>
  comments
    .filter(
      (comment) =>
        comment.source === 'review' &&
        comment.inReplyToId === undefined &&
        comment.resolved !== true,
    )
    .map((comment) => ({
      author: comment.author,
      path: comment.path ?? null,
      body: comment.body,
      isResolved: false,
    }));

export const makeBranchFactsReaders = ({
  getState,
  commitRange,
}: MakeBranchFactsReadersParams): BranchFactsReaders => ({
  commits: async ({ sessionId, worktreePath }) => {
    const base = selectMountBaseBranch({ state: getState(), sessionId, path: worktreePath });
    if (base === null) {
      throw new Error('this mount has no base branch');
    }
    const range = await commitRange({ worktreePath, base: `origin/${base}`, head: 'HEAD' }).catch(
      () => commitRange({ worktreePath, base, head: 'HEAD' }),
    );
    return range.map((commit) => ({ sha: commit.sha, subject: commit.subject }));
  },
  request: async ({ sessionId, mountId }): Promise<RequestFacts | null> => {
    const mount = brandId<MountId>({ value: mountId });
    await refreshActiveRequest({ get: getState, sessionId, mountId: mount });
    const port = pullRequestPortFor({ get: getState, sessionId, mountId: mount });
    if (port === null) {
      return null;
    }
    const view = await port.read();
    return { request: requestOf({ view }), checks: checksOf({ view }) };
  },
  threads: async ({ params, request }) => {
    await getState().refreshReviewSource({
      sessionId: params.sessionId,
      force: true,
      silent: true,
    });
    const state = getState();
    if (request.host === 'github') {
      const github = state.sessionGithub?.[params.sessionId];
      if (github?.pr?.number !== request.number) {
        throw new Error(NOT_OPEN_HERE);
      }
      return openThreadsOf({ comments: github.detail?.comments ?? [] });
    }
    const stored = state.reviewSourceThreads?.[params.sessionId]?.[request.url];
    if (stored === undefined || stored.fetchedAt === null) {
      throw new Error(stored?.error ?? NOT_OPEN_HERE);
    }
    return openThreadsOf({ comments: stored.comments });
  },
});
