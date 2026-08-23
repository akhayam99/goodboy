import type {
  LinkedIssue,
  PullRequestChecks,
  PullRequestState,
  PullRequestStateKind,
} from '@goodboy/types';
import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, runJson } from './gh';
import { fetchMergeQueuePlacements, type MergeQueuePlacement } from './merge-queue';

export const PR_FIELDS = [
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
  'autoMergeRequest',
] as const;

export type RawStatusCheck = {
  state?: string | null;
  status?: string | null;
  conclusion?: string | null;
};

export type RawPullRequest = {
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  isDraft: boolean;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN' | null;
  baseRefName: string;
  headRefName: string;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  statusCheckRollup: ReadonlyArray<RawStatusCheck> | null;
  updatedAt: string;
  body: string | null;
  autoMergeRequest: Record<string, unknown> | null;
};

type ClosingIssueRef = {
  number: number;
  title?: string;
  url: string;
};

const UNFINISHED_CHECK_STATUSES = new Set([
  'REQUESTED',
  'QUEUED',
  'IN_PROGRESS',
  'WAITING',
  'PENDING',
]);

const FAILED_CHECK_CONCLUSIONS = new Set([
  'FAILURE',
  'CANCELLED',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
]);

const FAILED_CHECK_STATES = new Set(['FAILURE', 'ERROR']);

const PASSED_CHECK_CONCLUSIONS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED', 'STALE']);

type CheckOutcome = 'pending' | 'success' | 'failure';

const readCheckSignal = ({ value }: { value?: string | null }): string | null => {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized === '' ? null : normalized;
};

const classifyCheck = ({ check }: { check: RawStatusCheck }): CheckOutcome => {
  const status = readCheckSignal({ value: check.status });
  if (status != null && UNFINISHED_CHECK_STATUSES.has(status)) {
    return 'pending';
  }
  const conclusion = readCheckSignal({ value: check.conclusion });
  if (conclusion != null && FAILED_CHECK_CONCLUSIONS.has(conclusion)) {
    return 'failure';
  }
  const state = readCheckSignal({ value: check.state });
  if (state != null && FAILED_CHECK_STATES.has(state)) {
    return 'failure';
  }
  if (conclusion != null && PASSED_CHECK_CONCLUSIONS.has(conclusion)) {
    return 'success';
  }
  if (state === 'SUCCESS') {
    return 'success';
  }
  return 'pending';
};

const deriveChecks = ({ raw }: { raw: RawPullRequest }): PullRequestChecks => {
  const checks = raw.statusCheckRollup ?? [];
  if (checks.length === 0) {
    return null;
  }
  const outcomes = checks.map((check) => classifyCheck({ check }));
  if (outcomes.includes('failure')) {
    return 'failure';
  }
  if (outcomes.includes('pending')) {
    return 'pending';
  }
  return 'success';
};

const deriveStateKind = ({
  raw,
  mergeQueue,
}: {
  raw: RawPullRequest;
  mergeQueue: MergeQueuePlacement | null;
}): PullRequestStateKind => {
  if (raw.state === 'MERGED') {
    return 'merged';
  }
  if (raw.state === 'CLOSED') {
    return 'closed';
  }
  if (raw.isDraft) {
    return 'draft';
  }
  if (mergeQueue != null) {
    return 'queued';
  }
  if (raw.autoMergeRequest != null) {
    return 'queued';
  }
  if (raw.reviewDecision === 'APPROVED') {
    return 'approved';
  }
  return 'open';
};

const deriveMergeable = ({ raw }: { raw: RawPullRequest }): boolean | null => {
  if (raw.mergeable === 'MERGEABLE') {
    return true;
  }
  if (raw.mergeable === 'CONFLICTING') {
    return false;
  }
  return null;
};

const REVIEW_DECISIONS: Record<string, PullRequestState['reviewDecision']> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REVIEW_REQUIRED: 'review_required',
};

export const toPullRequestState = ({
  raw,
  mergeQueue = null,
}: {
  raw: RawPullRequest;
  mergeQueue?: MergeQueuePlacement | null;
}): PullRequestState => ({
  number: raw.number,
  title: raw.title,
  url: raw.url,
  state: deriveStateKind({ raw, mergeQueue }),
  mergeable: deriveMergeable({ raw }),
  checks: deriveChecks({ raw }),
  baseBranch: raw.baseRefName,
  headBranch: raw.headRefName,
  isDraft: raw.isDraft,
  reviewDecision:
    raw.reviewDecision != null ? (REVIEW_DECISIONS[raw.reviewDecision] ?? null) : null,
  body: raw.body ?? '',
  updatedAt: raw.updatedAt,
  mergeQueue,
});

export const resolvePrForBranch = async (
  runner: GhRunner,
  repo: string,
  branch: string,
  opts: GhRunOptions = {},
): Promise<PullRequestState | null> => {
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
    if (err instanceof GhCliError) {
      return null;
    }
    throw err;
  }
  if (raw.length === 0) {
    return null;
  }
  const open = raw.filter((p) => p.state === 'OPEN');
  open.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const head = open[0] ?? [...raw].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (head == null) {
    return null;
  }
  const placements = await fetchMergeQueuePlacements({ runner, repo, branch, opts });
  return toPullRequestState({ raw: head, mergeQueue: placements.get(head.number) ?? null });
};

export const listPrsForBranch = async (
  runner: GhRunner,
  repo: string,
  branch: string,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<PullRequestState>> => {
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
  const raw = await runJson<ReadonlyArray<RawPullRequest>>(runner, args, opts);
  if (raw.length === 0) {
    return [];
  }
  const placements = await fetchMergeQueuePlacements({ runner, repo, branch, opts });
  return [...raw]
    .sort((a, b) => {
      const aTerminal = a.state === 'OPEN' ? 0 : 1;
      const bTerminal = b.state === 'OPEN' ? 0 : 1;
      if (aTerminal !== bTerminal) {
        return aTerminal - bTerminal;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .map((pr) => toPullRequestState({ raw: pr, mergeQueue: placements.get(pr.number) ?? null }));
};

const LINKED_KEYWORD_RE =
  /\b(close[sd]?|fix(?:es|ed)?|resolve[sd]?|ref(?:s|erence[sd]?)?)\s+#(\d+)/gi;

export const parseLinkedIssuesFromBody = (
  body: string,
  repoUrl: string,
): ReadonlyArray<LinkedIssue> => {
  const seen = new Map<number, LinkedIssue>();
  const repoBase = (repoUrl.split('/pull/', 1)[0] ?? repoUrl).replace(/\.git$/, '');
  for (const match of body.matchAll(LINKED_KEYWORD_RE)) {
    const keyword = match[1]?.toLowerCase();
    const numberStr = match[2];
    if (!keyword || !numberStr) {
      continue;
    }
    const number = Number.parseInt(numberStr, 10);
    if (!Number.isFinite(number)) {
      continue;
    }
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
};

export const fetchLinkedIssues = async (
  runner: GhRunner,
  repo: string,
  pr: PullRequestState,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<LinkedIssue>> => {
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
    if (err instanceof GhCliError) {
      return fromBody;
    }
    throw err;
  }
};

export const detectRepoSlug = async (
  runner: GhRunner,
  cwd: string,
  workspaceId?: string,
  projectId?: string,
): Promise<string | null> => {
  try {
    const res = await runner.run(
      ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
      {
        cwd,
        workspaceId,
        projectId,
      },
    );
    if (res.exitCode !== 0) {
      return null;
    }
    const slug = res.stdout.trim();
    return slug.length > 0 ? slug : null;
  } catch {
    return null;
  }
};
