import type {
  PrCheckConclusion,
  PrCheckRun,
  PrComment,
  PrDetail,
  PrReview,
  PrReviewRequest,
  PrReviewState,
} from '@kay-am/types';
import type { GhRunner } from './gh';
import { GhCliError, runJson } from './gh';

interface RawIssueComment {
  id: number;
  user: { login: string; avatar_url: string | null } | null;
  body: string | null;
  created_at: string;
  html_url: string;
}

interface RawReviewComment {
  id: number;
  user: { login: string; avatar_url: string | null } | null;
  body: string | null;
  created_at: string;
  html_url: string;
}

interface RawReview {
  id: number;
  author: { login: string } | null;
  authorAssociation: string;
  body: string | null;
  state: string;
  submittedAt: string | null;
}

interface RawReviewRequestUser {
  login: string;
  avatarUrl?: string | null;
}

interface RawReviewRequestTeam {
  name: string;
  avatarUrl?: string | null;
}

interface RawCheckRollupEntry {
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  state?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  detailsUrl?: string | null;
  workflowName?: string | null;
}

interface RawPrViewForDetail {
  reviews?: ReadonlyArray<RawReview> | null;
  reviewRequests?: ReadonlyArray<RawReviewRequestUser | RawReviewRequestTeam> | null;
  statusCheckRollup?: ReadonlyArray<RawCheckRollupEntry> | null;
}

function mapReviewState(raw: string): PrReviewState {
  const normalized = raw.toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'changes_requested') return 'changes_requested';
  if (normalized === 'dismissed') return 'dismissed';
  if (normalized === 'pending') return 'pending';
  return 'commented';
}

function mapCheckConclusion(raw: RawCheckRollupEntry): PrCheckConclusion {
  const status = (raw.status ?? '').toLowerCase();
  const conclusion = (raw.conclusion ?? '').toLowerCase();
  const state = (raw.state ?? '').toLowerCase();
  if (status === 'in_progress' || status === 'queued' || status === 'pending') return 'pending';
  if (state === 'pending') return 'pending';
  if (conclusion === 'success' || state === 'success') return 'success';
  if (conclusion === 'failure' || state === 'failure' || state === 'error') return 'failure';
  if (conclusion === 'neutral') return 'neutral';
  if (conclusion === 'cancelled') return 'cancelled';
  if (conclusion === 'timed_out') return 'timed_out';
  if (conclusion === 'action_required') return 'action_required';
  if (conclusion === 'stale') return 'stale';
  if (conclusion === 'skipped') return 'skipped';
  return 'unknown';
}

function deriveCheckDuration(raw: RawCheckRollupEntry): number | null {
  if (!raw.startedAt || !raw.completedAt) return null;
  const start = Date.parse(raw.startedAt);
  const end = Date.parse(raw.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

function dedupeComments(list: ReadonlyArray<PrComment>): ReadonlyArray<PrComment> {
  const seen = new Set<string>();
  const out: Array<PrComment> = [];
  for (const c of list) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

async function fetchIssueComments(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: { cwd?: string } = {},
): Promise<ReadonlyArray<PrComment>> {
  try {
    const raw = await runJson<ReadonlyArray<RawIssueComment>>(
      runner,
      ['api', `repos/${repo}/issues/${prNumber}/comments`, '--paginate'],
      opts,
    );
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
    if (err instanceof GhCliError) return [];
    throw err;
  }
}

async function fetchReviewComments(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: { cwd?: string } = {},
): Promise<ReadonlyArray<PrComment>> {
  try {
    const raw = await runJson<ReadonlyArray<RawReviewComment>>(
      runner,
      ['api', `repos/${repo}/pulls/${prNumber}/comments`, '--paginate'],
      opts,
    );
    return raw.map((c) => ({
      id: `review-${c.id}`,
      author: c.user?.login ?? 'unknown',
      authorAvatarUrl: c.user?.avatar_url ?? null,
      body: c.body ?? '',
      createdAt: c.created_at,
      url: c.html_url,
      source: 'review' as const,
    }));
  } catch (err) {
    if (err instanceof GhCliError) return [];
    throw err;
  }
}

async function fetchPrViewDetail(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: { cwd?: string } = {},
): Promise<RawPrViewForDetail> {
  try {
    return await runJson<RawPrViewForDetail>(
      runner,
      [
        'pr',
        'view',
        String(prNumber),
        '--repo',
        repo,
        '--json',
        'reviews,reviewRequests,statusCheckRollup',
      ],
      opts,
    );
  } catch (err) {
    if (err instanceof GhCliError) return {};
    throw err;
  }
}

export async function fetchPrDetail(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: { cwd?: string } = {},
): Promise<PrDetail> {
  const [issueComments, reviewComments, prView] = await Promise.all([
    fetchIssueComments(runner, repo, prNumber, opts),
    fetchReviewComments(runner, repo, prNumber, opts),
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
}
