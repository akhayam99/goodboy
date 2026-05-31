import type { LinkedIssue, PullRequestState, PullRequestStateKind } from '@goodboy/types';
import type { GhRunner } from './gh';
import { GhCliError, runJson } from './gh';

const PR_FIELDS = [
  'number',
  'title',
  'url',
  'state',
  'isDraft',
  'mergeable',
  'baseRefName',
  'headRefName',
  'reviewDecision',
  'statusCheckRollup',
  'updatedAt',
  'body',
] as const;

interface RawPullRequest {
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  isDraft: boolean;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN' | null;
  baseRefName: string;
  headRefName: string;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  statusCheckRollup: ReadonlyArray<{
    state?: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | null;
    conclusion?: 'SUCCESS' | 'FAILURE' | 'NEUTRAL' | 'CANCELLED' | 'TIMED_OUT' | null;
  }> | null;
  updatedAt: string;
  body: string | null;
}

interface ClosingIssueRef {
  number: number;
  title?: string;
  url: string;
}

function deriveStateKind(raw: RawPullRequest): PullRequestStateKind {
  if (raw.state === 'MERGED') return 'merged';
  if (raw.state === 'CLOSED') return 'closed';
  if (raw.isDraft) return 'draft';
  if (raw.reviewDecision === 'APPROVED') return 'approved';
  return 'open';
}

function deriveChecks(raw: RawPullRequest): PullRequestState['checks'] {
  const checks = raw.statusCheckRollup ?? [];
  if (checks.length === 0) return null;
  let pending = false;
  for (const c of checks) {
    const status = c.conclusion ?? c.state ?? null;
    if (
      status === 'FAILURE' ||
      status === 'CANCELLED' ||
      status === 'TIMED_OUT' ||
      status === 'ERROR'
    ) {
      return 'failure';
    }
    if (status === 'PENDING' || status === null) pending = true;
  }
  return pending ? 'pending' : 'success';
}

function deriveMergeable(raw: RawPullRequest): boolean | null {
  if (raw.mergeable === 'MERGEABLE') return true;
  if (raw.mergeable === 'CONFLICTING') return false;
  return null;
}

function toPullRequestState(raw: RawPullRequest): PullRequestState {
  const reviewMap: Record<string, PullRequestState['reviewDecision']> = {
    APPROVED: 'approved',
    CHANGES_REQUESTED: 'changes_requested',
    REVIEW_REQUIRED: 'review_required',
  };
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    state: deriveStateKind(raw),
    mergeable: deriveMergeable(raw),
    checks: deriveChecks(raw),
    baseBranch: raw.baseRefName,
    headBranch: raw.headRefName,
    isDraft: raw.isDraft,
    reviewDecision: raw.reviewDecision ? (reviewMap[raw.reviewDecision] ?? null) : null,
    body: raw.body ?? '',
    updatedAt: raw.updatedAt,
  };
}

export async function resolvePrForBranch(
  runner: GhRunner,
  repo: string,
  branch: string,
  opts: { cwd?: string; token?: string; workspaceId?: string } = {},
): Promise<PullRequestState | null> {
  const args = [
    'pr',
    'list',
    '--repo',
    repo,
    '--head',
    branch,
    '--state',
    'all',
    '--limit',
    '5',
    '--json',
    PR_FIELDS.join(','),
  ];
  let raw: ReadonlyArray<RawPullRequest>;
  try {
    raw = await runJson<ReadonlyArray<RawPullRequest>>(runner, args, opts);
  } catch (err) {
    if (err instanceof GhCliError) return null;
    throw err;
  }
  if (raw.length === 0) return null;
  const open = raw.filter((p) => p.state === 'OPEN');
  open.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const head = open[0] ?? [...raw].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return head ? toPullRequestState(head) : null;
}

export async function listPrsForBranch(
  runner: GhRunner,
  repo: string,
  branch: string,
  opts: { cwd?: string; token?: string; workspaceId?: string } = {},
): Promise<ReadonlyArray<PullRequestState>> {
  const args = [
    'pr',
    'list',
    '--repo',
    repo,
    '--head',
    branch,
    '--state',
    'all',
    '--limit',
    '20',
    '--json',
    PR_FIELDS.join(','),
  ];
  let raw: ReadonlyArray<RawPullRequest>;
  try {
    raw = await runJson<ReadonlyArray<RawPullRequest>>(runner, args, opts);
  } catch (err) {
    if (err instanceof GhCliError) return [];
    throw err;
  }
  return [...raw]
    .sort((a, b) => {
      const aTerminal = a.state === 'OPEN' ? 0 : 1;
      const bTerminal = b.state === 'OPEN' ? 0 : 1;
      if (aTerminal !== bTerminal) return aTerminal - bTerminal;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .map(toPullRequestState);
}

const LINKED_KEYWORD_RE =
  /\b(close[sd]?|fix(?:es|ed)?|resolve[sd]?|ref(?:s|erence[sd]?)?)\s+#(\d+)/gi;

export function parseLinkedIssuesFromBody(
  body: string,
  repoUrl: string,
): ReadonlyArray<LinkedIssue> {
  const seen = new Map<number, LinkedIssue>();
  const repoBase = repoUrl.replace(/\/pull\/\d+.*$/, '').replace(/\.git$/, '');
  for (const match of body.matchAll(LINKED_KEYWORD_RE)) {
    const keyword = match[1]?.toLowerCase();
    const numberStr = match[2];
    if (!keyword || !numberStr) continue;
    const number = Number.parseInt(numberStr, 10);
    if (!Number.isFinite(number)) continue;
    const closes = !keyword.startsWith('ref');
    const existing = seen.get(number);
    if (!existing || (closes && !existing.closes)) {
      seen.set(number, {
        number,
        url: `${repoBase}/issues/${number}`,
        closes,
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.number - b.number);
}

export async function fetchLinkedIssues(
  runner: GhRunner,
  repo: string,
  pr: PullRequestState,
  opts: { cwd?: string; token?: string; workspaceId?: string } = {},
): Promise<ReadonlyArray<LinkedIssue>> {
  const fromBody = parseLinkedIssuesFromBody(pr.body, pr.url);
  try {
    const args = [
      'pr',
      'view',
      String(pr.number),
      '--repo',
      repo,
      '--json',
      'closingIssuesReferences',
    ];
    const res = await runJson<{ closingIssuesReferences: ReadonlyArray<ClosingIssueRef> }>(
      runner,
      args,
      opts,
    );
    const merged = new Map<number, LinkedIssue>();
    for (const item of fromBody) merged.set(item.number, item);
    for (const item of res.closingIssuesReferences ?? []) {
      const existing = merged.get(item.number);
      merged.set(item.number, {
        number: item.number,
        title: item.title,
        url: item.url,
        closes: existing?.closes ?? true,
      });
    }
    return [...merged.values()].sort((a, b) => a.number - b.number);
  } catch (err) {
    if (err instanceof GhCliError) return fromBody;
    throw err;
  }
}

export async function detectRepoSlug(
  runner: GhRunner,
  cwd: string,
  workspaceId?: string,
): Promise<string | null> {
  try {
    const res = await runner.run(
      ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
      {
        cwd,
        workspaceId,
      },
    );
    if (res.exitCode !== 0) return null;
    const slug = res.stdout.trim();
    return slug.length > 0 ? slug : null;
  } catch {
    return null;
  }
}
