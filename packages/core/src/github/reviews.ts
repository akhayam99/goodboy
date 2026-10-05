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
  const raw = await runJson<RawPrIdResponse>({
    runner,
    args: ['pr', 'view', String(prNumber), '--repo', repo, '--json', 'id'],
    opts,
    shape: 'object',
  });
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

export type ReviewFileThreadDraft = {
  readonly path: string;
  readonly body: string;
};

type RawGraphqlResponse<T> = {
  data?: T | null;
  errors?: ReadonlyArray<{ message: string }>;
};

const runGraphql = async <T>({
  runner,
  query,
  variables,
  opts,
  label,
}: {
  readonly runner: GhRunner;
  readonly query: string;
  readonly variables: ReadonlyArray<readonly [string, string]>;
  readonly opts: GhRunOptions;
  readonly label: string;
}): Promise<T> => {
  const raw = await runJson<RawGraphqlResponse<T>>({
    runner,
    args: [
      'api',
      'graphql',
      '-f',
      `query=${query}`,
      ...variables.flatMap(([name, value]) => ['-f', `${name}=${value}`]),
    ],
    opts,
    shape: 'object',
  });
  if (raw.errors && raw.errors.length > 0) {
    const first = raw.errors[0]?.message ?? 'unknown graphql error';
    throw new GhCliError(`${label} failed: ${first}`, first, 1);
  }
  if (!raw.data) {
    throw new GhCliError(`${label} returned no data`, JSON.stringify(raw), 1);
  }
  return raw.data;
};

const addPendingReview = async ({
  runner,
  pullRequestId,
  threads,
  opts,
}: {
  readonly runner: GhRunner;
  readonly pullRequestId: string;
  readonly threads: ReadonlyArray<ReviewThreadDraft>;
  readonly opts: GhRunOptions;
}): Promise<string> => {
  const data = await runGraphql<{
    addPullRequestReview?: { pullRequestReview?: { id: string } | null } | null;
  }>({
    runner,
    query: `mutation($pullRequestId:ID!){
  addPullRequestReview(input:{pullRequestId:$pullRequestId,threads:[${threads.map(threadLiteral).join(',')}]}){
    pullRequestReview{ id }
  }
}`,
    variables: [['pullRequestId', pullRequestId]],
    opts,
    label: 'addPullRequestReview',
  });
  const id = data.addPullRequestReview?.pullRequestReview?.id;
  if (!id) {
    throw new GhCliError('addPullRequestReview returned no review', JSON.stringify(data), 1);
  }
  return id;
};

const addFileThread = async ({
  runner,
  reviewId,
  thread,
  opts,
}: {
  readonly runner: GhRunner;
  readonly reviewId: string;
  readonly thread: ReviewFileThreadDraft;
  readonly opts: GhRunOptions;
}): Promise<void> => {
  const data = await runGraphql<{
    addPullRequestReviewThread?: { thread?: { id: string } | null } | null;
  }>({
    runner,
    query: `mutation($reviewId:ID!,$path:String!,$body:String!){
  addPullRequestReviewThread(input:{pullRequestReviewId:$reviewId,path:$path,body:$body,subjectType:FILE}){
    thread{ id }
  }
}`,
    variables: [
      ['reviewId', reviewId],
      ['path', thread.path],
      ['body', thread.body],
    ],
    opts,
    label: 'addPullRequestReviewThread',
  });
  if (!data.addPullRequestReviewThread?.thread?.id) {
    throw new GhCliError('addPullRequestReviewThread returned no thread', JSON.stringify(data), 1);
  }
};

const submitPendingReview = async ({
  runner,
  reviewId,
  event,
  body,
  opts,
}: {
  readonly runner: GhRunner;
  readonly reviewId: string;
  readonly event: ReviewEvent;
  readonly body: string;
  readonly opts: GhRunOptions;
}): Promise<PostedPullRequestReview> => {
  const data = await runGraphql<{
    submitPullRequestReview?: { pullRequestReview?: { id: string; url: string } | null } | null;
  }>({
    runner,
    query: `mutation($reviewId:ID!,$body:String!){
  submitPullRequestReview(input:{pullRequestReviewId:$reviewId,event:${event},body:$body}){
    pullRequestReview{ id url }
  }
}`,
    variables: [
      ['reviewId', reviewId],
      ['body', body],
    ],
    opts,
    label: 'submitPullRequestReview',
  });
  const review = data.submitPullRequestReview?.pullRequestReview;
  if (!review) {
    throw new GhCliError('submitPullRequestReview returned no review', JSON.stringify(data), 1);
  }
  return { id: review.id, url: review.url };
};

const discardPendingReview = async ({
  runner,
  reviewId,
  opts,
}: {
  readonly runner: GhRunner;
  readonly reviewId: string;
  readonly opts: GhRunOptions;
}): Promise<void> => {
  try {
    await runGraphql<unknown>({
      runner,
      query: `mutation($reviewId:ID!){
  deletePullRequestReview(input:{pullRequestReviewId:$reviewId}){ clientMutationId }
}`,
      variables: [['reviewId', reviewId]],
      opts,
      label: 'deletePullRequestReview',
    });
  } catch {
    return;
  }
};

const addReviewWithFileThreads = async ({
  runner,
  input,
  opts,
}: {
  readonly runner: GhRunner;
  readonly input: {
    readonly pullRequestId: string;
    readonly event: ReviewEvent;
    readonly body: string;
    readonly threads: ReadonlyArray<ReviewThreadDraft>;
    readonly fileThreads: ReadonlyArray<ReviewFileThreadDraft>;
  };
  readonly opts: GhRunOptions;
}): Promise<PostedPullRequestReview> => {
  const reviewId = await addPendingReview({
    runner,
    pullRequestId: input.pullRequestId,
    threads: input.threads,
    opts,
  });
  try {
    for (const thread of input.fileThreads) {
      await addFileThread({ runner, reviewId, thread, opts });
    }
    return await submitPendingReview({
      runner,
      reviewId,
      event: input.event,
      body: input.body,
      opts,
    });
  } catch (err) {
    await discardPendingReview({ runner, reviewId, opts });
    throw err;
  }
};

export const addPullRequestReview = async (
  runner: GhRunner,
  input: {
    pullRequestId: string;
    event: ReviewEvent;
    body: string;
    threads: ReadonlyArray<ReviewThreadDraft>;
    fileThreads?: ReadonlyArray<ReviewFileThreadDraft>;
  },
  opts: GhRunOptions = {},
): Promise<PostedPullRequestReview> => {
  if (input.fileThreads !== undefined && input.fileThreads.length > 0) {
    return addReviewWithFileThreads({
      runner,
      input: { ...input, fileThreads: input.fileThreads },
      opts,
    });
  }
  const threads = input.threads.map(threadLiteral).join(',');
  const mutation = `mutation($pullRequestId:ID!,$body:String!){
  addPullRequestReview(input:{pullRequestId:$pullRequestId,event:${input.event},body:$body,threads:[${threads}]}){
    pullRequestReview{ id url }
  }
}`;
  const raw = await runJson<RawAddReviewResponse>({
    runner,
    args: [
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
    shape: 'object',
  });
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
