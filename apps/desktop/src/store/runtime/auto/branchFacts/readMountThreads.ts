import type { BranchFactsRequest, BranchFactsThread } from '@goodboy/core';
import { brandId, type MountId, type PrComment } from '@goodboy/types';
import type { AppStore } from '../../../store';
import type { ReadBranchFactsParams } from '../ports';

type CommentsParams = {
  readonly comments: ReadonlyArray<PrComment>;
};

const openThreadsOf = ({ comments }: CommentsParams): ReadonlyArray<BranchFactsThread> =>
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

type Params = Readonly<{
  getState: () => AppStore;
  params: ReadBranchFactsParams;
  request: BranchFactsRequest;
}>;

const NOT_OPEN_HERE = 'that request is not the one open on this mount';
const NOT_READ = 'the review threads of this request were not read';

export const readMountThreads = async ({
  getState,
  params,
  request,
}: Params): Promise<ReadonlyArray<BranchFactsThread>> => {
  const { sessionId } = params;
  const mountId = brandId<MountId>({ value: params.mountId });
  if (request.host === 'github') {
    await getState().refreshSessionPrDetail(sessionId, { mountId, force: true });
    const github = getState().mountGithub?.[mountId];
    if (github === undefined) {
      throw new Error(NOT_READ);
    }
    if (github.detailError !== null) {
      throw new Error(github.detailError);
    }
    if (github.detail === null) {
      throw new Error(NOT_READ);
    }
    if (github.detail.prNumber !== request.number) {
      throw new Error(NOT_OPEN_HERE);
    }
    return openThreadsOf({ comments: github.detail.comments });
  }
  await getState().refreshReviewSource({ sessionId, force: true, silent: true });
  const stored = getState().reviewSourceThreads?.[sessionId]?.[request.url];
  if (stored === undefined || stored.fetchedAt === null) {
    throw new Error(stored?.error ?? NOT_OPEN_HERE);
  }
  return openThreadsOf({ comments: stored.comments });
};
