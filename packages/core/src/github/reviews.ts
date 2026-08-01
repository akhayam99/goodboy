import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, runJson } from './gh';

export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';

export type ReviewThreadDraft = {
  readonly path: string;
  readonly line: number;
  readonly side: 'LEFT' | 'RIGHT';
  readonly startLine: number | null;
  readonly startSide: 'LEFT' | 'RIGHT' | null;
  readonly body: string;
};

export type PostedPullRequestReview = {
  readonly id: string;
  readonly url: string;
};

type RawPrIdResponse = {
  id?: string;
};

export const fetchPrNodeId = async (
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: GhRunOptions = {},
): Promise<string> => {
  const raw = await runJson<RawPrIdResponse>(
    runner,
    ['pr', 'view', String(prNumber), '--repo', repo, '--json', 'id'],
    opts,
  );
  const id = raw.id ?? '';
  if (id.length === 0) {
    throw new GhCliError(`pr ${repo}#${prNumber} returned no node id`, JSON.stringify(raw), 1);
  }
  return id;
};

const threadLiteral = (thread: ReviewThreadDraft): string => {
  const startFields =
    thread.startLine != null
      ? `startLine:${thread.startLine},startSide:${thread.startSide ?? thread.side},`
      : '';
  return `{path:${JSON.stringify(thread.path)},line:${thread.line},side:${thread.side},${startFields}body:${JSON.stringify(thread.body)}}`;
};

type RawAddReviewResponse = {
  data?: {
    addPullRequestReview?: {
      pullRequestReview?: { id: string; url: string } | null;
    } | null;
  };
  errors?: ReadonlyArray<{ message: string }>;
};

export const addPullRequestReview = async (
  runner: GhRunner,
  input: {
    pullRequestId: string;
    event: ReviewEvent;
    body: string;
    threads: ReadonlyArray<ReviewThreadDraft>;
  },
  opts: GhRunOptions = {},
): Promise<PostedPullRequestReview> => {
  const threads = input.threads.map(threadLiteral).join(',');
  const mutation = `mutation($pullRequestId:ID!,$body:String!){
  addPullRequestReview(input:{pullRequestId:$pullRequestId,event:${input.event},body:$body,threads:[${threads}]}){
    pullRequestReview{ id url }
  }
}`;
  const raw = await runJson<RawAddReviewResponse>(
    runner,
    [
      'api',
      'graphql',
      '-f',
      `query=${mutation}`,
      '-F',
      `pullRequestId=${input.pullRequestId}`,
      '-f',
      `body=${input.body}`,
    ],
    opts,
  );
  if (raw.errors && raw.errors.length > 0) {
    const first = raw.errors[0]?.message ?? 'unknown graphql error';
    throw new GhCliError(`addPullRequestReview failed: ${first}`, first, 1);
  }
  const review = raw.data?.addPullRequestReview?.pullRequestReview;
  if (!review) {
    throw new GhCliError('addPullRequestReview returned no review', JSON.stringify(raw), 1);
  }
  return { id: review.id, url: review.url };
};
