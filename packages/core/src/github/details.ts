import type {
  PrCheckConclusion,
  PrCheckRun,
  PrComment,
  PrDetail,
  PrReview,
  PrReviewRequest,
  PrReviewState,
} from '@goodboy/types';
import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, runJson } from './gh';

type RawIssueComment = {
  id: number;
  user: { login: string; avatar_url: string | null } | null;
  body: string | null;
  created_at: string;
  html_url: string;
};

type RawReviewThreadComment = {
  id: string;
  databaseId: number;
  author: { login: string; avatarUrl: string | null } | null;
  body: string | null;
  createdAt: string;
  url: string;
  replyTo: { id: string } | null;
};

type RawReviewThreadNode = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  viewerCanResolve?: boolean;
  path: string | null;
  line: number | null;
  comments: { nodes: ReadonlyArray<RawReviewThreadComment> } | null;
};

type RawReviewThreadsResponse = {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          pageInfo?: { hasNextPage: boolean; endCursor: string | null } | null;
          nodes?: ReadonlyArray<RawReviewThreadNode>;
        } | null;
      } | null;
    } | null;
  };
  errors?: ReadonlyArray<{ message: string }>;
};

type RawReview = {
  id: number;
  author: { login: string } | null;
  authorAssociation: string;
  body: string | null;
  state: string;
  submittedAt: string | null;
};

type RawReviewRequestUser = {
  login: string;
  avatarUrl?: string | null;
};

type RawReviewRequestTeam = {
  name: string;
  avatarUrl?: string | null;
};

type RawCheckRollupEntry = {
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  state?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  detailsUrl?: string | null;
  workflowName?: string | null;
};

type RawPrViewForDetail = {
  reviews?: ReadonlyArray<RawReview> | null;
  reviewRequests?: ReadonlyArray<RawReviewRequestUser | RawReviewRequestTeam> | null;
  statusCheckRollup?: ReadonlyArray<RawCheckRollupEntry> | null;
};

function mapReviewState(raw: string): PrReviewState {
  const normalized = raw.toLowerCase();
  if (normalized === 'approved') {
    return 'approved';
  }
  if (normalized === 'changes_requested') {
    return 'changes_requested';
  }
  if (normalized === 'dismissed') {
    return 'dismissed';
  }
  if (normalized === 'pending') {
    return 'pending';
  }
  return 'commented';
}

function mapCheckConclusion(raw: RawCheckRollupEntry): PrCheckConclusion {
  const status = (raw.status ?? '').toLowerCase();
  const conclusion = (raw.conclusion ?? '').toLowerCase();
  const state = (raw.state ?? '').toLowerCase();
  if (status === 'in_progress' || status === 'queued' || status === 'pending') {
    return 'pending';
  }
  if (state === 'pending') {
    return 'pending';
  }
  if (conclusion === 'success' || state === 'success') {
    return 'success';
  }
  if (conclusion === 'failure' || state === 'failure' || state === 'error') {
    return 'failure';
  }
  if (conclusion === 'neutral') {
    return 'neutral';
  }
  if (conclusion === 'cancelled') {
    return 'cancelled';
  }
  if (conclusion === 'timed_out') {
    return 'timed_out';
  }
  if (conclusion === 'action_required') {
    return 'action_required';
  }
  if (conclusion === 'stale') {
    return 'stale';
  }
  if (conclusion === 'skipped') {
    return 'skipped';
  }
  return 'unknown';
}

function deriveCheckDuration(raw: RawCheckRollupEntry): number | null {
  if (!raw.startedAt || !raw.completedAt) {
    return null;
  }
  const start = Date.parse(raw.startedAt);
  const end = Date.parse(raw.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return Math.max(0, end - start);
}

function dedupeComments(list: ReadonlyArray<PrComment>): ReadonlyArray<PrComment> {
  const seen = new Set<string>();
  const out: Array<PrComment> = [];
  for (const c of list) {
    if (seen.has(c.id)) {
      continue;
    }
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

async function fetchIssueComments(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<PrComment>> {
  try {
    const raw = await runJson<ReadonlyArray<RawIssueComment>>({
      runner,
      args: ['api', `repos/${repo}/issues/${prNumber}/comments`, '--paginate'],
      opts,
      shape: 'array',
    });
    return raw.map((c) => ({
      id: `issue-${c.id}`,
      author: c.user?.login ?? 'unknown',
      authorAvatarUrl: c.user?.avatar_url ?? null,
      body: c.body ?? '',
      createdAt: c.created_at,
      url: c.html_url,
      source: 'issue' as const,
    }));
  } catch (err) {
    if (err instanceof GhCliError) {
      return [];
    }
    throw err;
  }
}

const REVIEW_THREADS_QUERY = `query($owner:String!,$name:String!,$pr:Int!,$after:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$pr){
      reviewThreads(first:100,after:$after){
        pageInfo{hasNextPage endCursor}
        nodes{
          id
          isResolved
          isOutdated
          viewerCanResolve
          path
          line
          comments(first:100){
            nodes{
              id
              databaseId
              author{login avatarUrl}
              body
              createdAt
              url
              replyTo{id}
            }
          }
        }
      }
    }
  }
}`;

const MAX_REVIEW_THREAD_PAGES = 50;

type ReviewThreadPageParams = {
  readonly runner: GhRunner;
  readonly owner: string;
  readonly name: string;
  readonly prNumber: number;
  readonly after: string | null;
  readonly opts: GhRunOptions;
};

const fetchReviewThreadPage = async ({
  runner,
  owner,
  name,
  prNumber,
  after,
  opts,
}: ReviewThreadPageParams): Promise<RawReviewThreadsResponse> => {
  const raw = await runJson<RawReviewThreadsResponse>({
    runner,
    args: [
      'api',
      'graphql',
      '-f',
      `query=${REVIEW_THREADS_QUERY}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
      '-F',
      `pr=${prNumber}`,
      ...(after === null ? [] : ['-f', `after=${after}`]),
    ],
    opts,
    shape: 'object',
  });
  const firstError = raw.errors?.[0]?.message;
  if (firstError !== undefined) {
    throw new GhCliError(`review threads query failed: ${firstError}`, firstError, 1);
  }
  return raw;
};

type AllReviewThreadsParams = {
  readonly runner: GhRunner;
  readonly repo: string;
  readonly prNumber: number;
  readonly opts: GhRunOptions;
};

const fetchAllReviewThreads = async ({
  runner,
  repo,
  prNumber,
  opts,
}: AllReviewThreadsParams): Promise<ReadonlyArray<RawReviewThreadNode>> => {
  const [owner = '', name = ''] = repo.split('/');
  if (owner === '' || name === '') {
    return [];
  }
  const threads: Array<RawReviewThreadNode> = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_REVIEW_THREAD_PAGES; page += 1) {
    const raw = await fetchReviewThreadPage({ runner, owner, name, prNumber, after, opts });
    const connection = raw.data?.repository?.pullRequest?.reviewThreads ?? null;
    threads.push(...(connection?.nodes ?? []));
    const next = connection?.pageInfo ?? null;
    if (next === null || !next.hasNextPage) {
      return threads;
    }
    if (next.endCursor === null || next.endCursor === after) {
      throw new GhCliError(
        'GitHub returned an incomplete page of review threads',
        JSON.stringify(next),
        1,
      );
    }
    after = next.endCursor;
  }
  throw new GhCliError(
    `This pull request has more than ${threads.length} review threads`,
    'too many review threads',
    1,
  );
};

async function fetchReviewThreads(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<PrComment>> {
  const threads = await fetchAllReviewThreads({ runner, repo, prNumber, opts });
  const out: Array<PrComment> = [];
  const nodeIdToCommentId = new Map<string, string>();
  for (const t of threads) {
    for (const c of t.comments?.nodes ?? []) {
      nodeIdToCommentId.set(c.id, `review-${c.databaseId}`);
    }
  }
  for (const t of threads) {
    const nodes = t.comments?.nodes ?? [];
    for (const c of nodes) {
      out.push({
        id: `review-${c.databaseId}`,
        author: c.author?.login ?? 'unknown',
        authorAvatarUrl: c.author?.avatarUrl ?? null,
        body: c.body ?? '',
        createdAt: c.createdAt,
        url: c.url,
        source: 'review',
        path: t.path ?? undefined,
        line: t.line ?? undefined,
        resolved: t.isResolved,
        outdated: t.isOutdated,
        inReplyToId: c.replyTo?.id ? (nodeIdToCommentId.get(c.replyTo.id) ?? undefined) : undefined,
        threadId: t.id,
        ...(t.viewerCanResolve !== undefined && { canResolve: t.viewerCanResolve }),
      });
    }
  }
  return out;
}

async function fetchPrViewDetail(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: GhRunOptions = {},
): Promise<RawPrViewForDetail> {
  try {
    return await runJson<RawPrViewForDetail>({
      runner,
      args: [
        'pr',
        'view',
        String(prNumber),
        '--repo',
        repo,
        '--json',
        'reviews,reviewRequests,statusCheckRollup',
      ],
      opts,
      shape: 'object',
    });
  } catch (err) {
    if (err instanceof GhCliError) {
      return {};
    }
    throw err;
  }
}

export const fetchPrDetail = async (
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: GhRunOptions = {},
): Promise<PrDetail> => {
  const [issueComments, reviewComments, prView] = await Promise.all([
    fetchIssueComments(runner, repo, prNumber, opts),
    fetchReviewThreads(runner, repo, prNumber, opts),
    fetchPrViewDetail(runner, repo, prNumber, opts),
  ]);

  const merged = dedupeComments([...issueComments, ...reviewComments]);
  const sorted = [...merged].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const reviews: ReadonlyArray<PrReview> = (prView.reviews ?? []).map((r) => ({
    id: `review-${r.id}`,
    author: r.author?.login ?? 'unknown',
    authorAvatarUrl: null,
    state: mapReviewState(r.state),
    submittedAt: r.submittedAt,
    body: r.body ?? '',
  }));

  const reviewRequests: ReadonlyArray<PrReviewRequest> = (prView.reviewRequests ?? []).map((rr) => {
    if ('login' in rr) {
      return {
        login: rr.login,
        avatarUrl: rr.avatarUrl ?? null,
        kind: 'user' as const,
      };
    }
    return {
      login: rr.name,
      avatarUrl: rr.avatarUrl ?? null,
      kind: 'team' as const,
    };
  });

  const checks: ReadonlyArray<PrCheckRun> = (prView.statusCheckRollup ?? []).map((entry) => ({
    name: entry.name ?? entry.workflowName ?? 'check',
    conclusion: mapCheckConclusion(entry),
    detailsUrl: entry.detailsUrl ?? null,
    durationMs: deriveCheckDuration(entry),
  }));

  return {
    prNumber,
    comments: sorted,
    reviews,
    reviewRequests,
    checks,
  };
};
