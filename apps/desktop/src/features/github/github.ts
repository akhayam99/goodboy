import { invoke } from '@tauri-apps/api/core';
import {
  createIssueComment,
  detectRepoSlug,
  fetchPrDetail,
  ghRunJson,
  listAssignedIssues,
  listIssueComments,
  listPrsForBranch,
  updateIssueBody,
} from '@goodboy/core';
import type { GhRunner, GhResult, GhRunOptions, PrCacheStore } from '@goodboy/core';
import type {
  GhTokenStatus,
  GithubIssue,
  GithubIssueComment,
  GithubPrCacheEntry,
  PrDetail,
  PullRequestState,
} from '@goodboy/types';
import {
  getGithubPrCache,
  upsertGithubPrCache,
  deleteGithubPrCache,
  type Database,
} from '@goodboy/db';
import { formatError } from '../../shared/lib/errors';

type RawGhRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type RawGhStatus = {
  available: boolean;
  mode: 'absent' | 'gh-cli' | 'pat';
  version: string | null;
  user: string | null;
  scopes: ReadonlyArray<string>;
  scoped: boolean;
};

function toStatus(raw: RawGhStatus): GhTokenStatus {
  return {
    available: raw.available,
    mode: raw.mode,
    version: raw.version ?? undefined,
    user: raw.user ?? undefined,
    scopes: raw.scopes,
    scoped: raw.scoped,
  };
}

export const ghStatus = async (workspaceId?: string): Promise<GhTokenStatus> => {
  try {
    return toStatus(await invoke<RawGhStatus>('gh_status', { workspaceId }));
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`gh status check failed: ${msg}`, { cause: err });
  }
};

export const ghSetToken = async (token: string, workspaceId?: string): Promise<GhTokenStatus> => {
  try {
    return toStatus(await invoke<RawGhStatus>('gh_set_token', { token, workspaceId }));
  } catch (err) {
    throw new Error(formatError(err), { cause: err });
  }
};

export const ghClearToken = async (workspaceId?: string): Promise<void> => {
  try {
    await invoke('gh_clear_token', { workspaceId });
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`gh clear token failed: ${msg}`, { cause: err });
  }
};

export const ghPrDiff = async (
  repo: string,
  pr: number,
  cwd?: string,
  workspaceId?: string,
  memberWorkspaceId?: string,
): Promise<string> => {
  try {
    return await invoke<string>('gh_pr_diff', {
      repo,
      pr,
      cwd,
      workspaceId,
      ...(memberWorkspaceId != null ? { memberWorkspaceId } : {}),
    });
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`PR diff fetch for ${repo}#${pr} failed: ${msg}`, { cause: err });
  }
};

export const gitPush = async (
  cwd: string,
  branch: string | null,
  workspaceId?: string,
  memberWorkspaceId?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  try {
    const raw = await invoke<RawGhRunResult>('git_push', {
      cwd,
      branch: branch ?? undefined,
      workspaceId,
      ...(memberWorkspaceId != null ? { memberWorkspaceId } : {}),
    });
    return { stdout: raw.stdout, stderr: raw.stderr, exitCode: raw.exitCode };
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`git push failed: ${msg}`, { cause: err });
  }
};

export const ghPrsForBranch = async (
  cwd: string,
  branch: string,
  workspaceId?: string,
): Promise<ReadonlyArray<PullRequestState>> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (!slug) {
    return [];
  }
  return listPrsForBranch(tauriGhRunner, slug, branch, { cwd, workspaceId });
};

export const ghAssignedIssues = async (
  slug: string,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<GithubIssue>> => listAssignedIssues(tauriGhRunner, slug, opts);

const ISSUE_VIEW_FIELDS = 'number,title,body,url,state,labels,updatedAt';

type RawGithubIssueView = {
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: string;
  labels: ReadonlyArray<{ name: string }>;
  updatedAt: string;
};

export const ghIssueByNumber = async (
  cwd: string,
  issueNumber: number,
  workspaceId?: string,
): Promise<GithubIssue> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (slug == null) {
    throw new Error('could not detect a GitHub repository for this workspace');
  }
  const raw = await ghRunJson<RawGithubIssueView>(
    tauriGhRunner,
    ['issue', 'view', String(issueNumber), '--repo', slug, '--json', ISSUE_VIEW_FIELDS],
    { cwd, workspaceId },
  );
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    url: raw.url,
    state: raw.state,
    labels: raw.labels.map((label) => label.name),
    updatedAt: raw.updatedAt,
  };
};

type UpdateIssueBodyParams = {
  readonly cwd: string;
  readonly issueNumber: number;
  readonly body: string;
  readonly workspaceId?: string;
};

export const ghUpdateIssueBody = async ({
  cwd,
  issueNumber,
  body,
  workspaceId,
}: UpdateIssueBodyParams): Promise<string> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (slug == null) {
    throw new Error('could not detect a GitHub repository for this workspace');
  }
  return updateIssueBody({
    runner: tauriGhRunner,
    repoSlug: slug,
    issueNumber,
    body,
    opts: { cwd, workspaceId },
  });
};

type IssueCommentsParams = {
  readonly cwd: string;
  readonly issueNumber: number;
  readonly workspaceId?: string;
};

export const ghIssueComments = async ({
  cwd,
  issueNumber,
  workspaceId,
}: IssueCommentsParams): Promise<ReadonlyArray<GithubIssueComment>> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (slug == null) {
    throw new Error('could not detect a GitHub repository for this workspace');
  }
  return listIssueComments({
    runner: tauriGhRunner,
    repoSlug: slug,
    issueNumber,
    opts: { cwd, workspaceId },
  });
};

type CreateIssueCommentParams = {
  readonly cwd: string;
  readonly issueNumber: number;
  readonly body: string;
  readonly workspaceId?: string;
};

export const ghCreateIssueComment = async ({
  cwd,
  issueNumber,
  body,
  workspaceId,
}: CreateIssueCommentParams): Promise<GithubIssueComment> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (slug == null) {
    throw new Error('could not detect a GitHub repository for this workspace');
  }
  return createIssueComment({
    runner: tauriGhRunner,
    repoSlug: slug,
    issueNumber,
    body,
    opts: { cwd, workspaceId },
  });
};

export const ghPrDetailByNumber = async (
  cwd: string,
  prNumber: number,
  workspaceId?: string,
): Promise<PrDetail | null> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (!slug) {
    return null;
  }
  return fetchPrDetail(tauriGhRunner, slug, prNumber, { cwd, workspaceId });
};

export const ghPrHeadBranch = async (
  cwd: string,
  prNumber: number,
  workspaceId?: string,
): Promise<string> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (!slug) {
    throw new Error('could not detect a GitHub repository for this workspace');
  }
  const res = await tauriGhRunner.run(
    [
      'pr',
      'view',
      String(prNumber),
      '--repo',
      slug,
      '--json',
      'headRefName',
      '--jq',
      '.headRefName',
    ],
    { cwd, workspaceId },
  );
  if (res.exitCode !== 0) {
    throw new Error(res.stderr.trim() || `gh pr view #${prNumber} exited ${res.exitCode}`);
  }
  const branch = res.stdout.trim();
  if (!branch) {
    throw new Error(`PR #${prNumber} has no head branch`);
  }
  return branch;
};

export const ghBaseBranches = async (
  cwd: string,
  workspaceId?: string,
  memberWorkspaceId?: string,
): Promise<{ defaultBranch: string | null; branches: ReadonlyArray<string> }> => {
  const [def, list] = await Promise.all([
    tauriGhRunner.run(
      ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'],
      {
        cwd,
        workspaceId,
        memberWorkspaceId,
      },
    ),
    tauriGhRunner.run(['api', 'repos/{owner}/{repo}/branches?per_page=100', '--jq', '.[].name'], {
      cwd,
      workspaceId,
      memberWorkspaceId,
    }),
  ]);
  const defaultBranch = def.exitCode === 0 ? def.stdout.trim() || null : null;
  const branches =
    list.exitCode === 0
      ? list.stdout
          .split('\n')
          .map((b) => b.trim())
          .filter(Boolean)
      : [];
  return { defaultBranch, branches };
};

export const ghRepoCollaborators = async (
  cwd: string,
  workspaceId?: string,
  memberWorkspaceId?: string,
): Promise<ReadonlyArray<string>> => {
  const res = await tauriGhRunner.run(
    ['api', 'repos/{owner}/{repo}/collaborators?per_page=100', '--jq', '.[].login'],
    { cwd, workspaceId, memberWorkspaceId },
  );
  if (res.exitCode !== 0) {
    return [];
  }
  return res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
};

export const ghCommitDiff = async (repo: string, sha: string): Promise<string> => {
  const res = await tauriGhRunner.run([
    'api',
    `repos/${repo}/commits/${sha}`,
    '-H',
    'Accept: application/vnd.github.diff',
  ]);
  if (res.exitCode !== 0) {
    throw new Error(res.stderr.trim() || `gh api commit ${repo}@${sha} exited ${res.exitCode}`);
  }
  return res.stdout;
};

export const tauriGhRunner: GhRunner = {
  async run(args: ReadonlyArray<string>, opts: GhRunOptions = {}): Promise<GhResult> {
    try {
      const raw = await invoke<RawGhRunResult>('gh_run', {
        args: [...args],
        cwd: opts.cwd,
        workspaceId: opts.workspaceId,
        ...(opts.memberWorkspaceId != null ? { memberWorkspaceId: opts.memberWorkspaceId } : {}),
      });
      return {
        stdout: raw.stdout,
        stderr: raw.stderr,
        exitCode: raw.exitCode,
      };
    } catch (err) {
      const msg = formatError(err);
      throw new Error(`gh run [${args.join(' ')}] failed: ${msg}`, { cause: err });
    }
  },
};

export const createTauriPrCacheStore = (db: Database): PrCacheStore => {
  return {
    async get(repoSlug, branch) {
      try {
        const entry = await getGithubPrCache(db, repoSlug, branch);
        return entry as GithubPrCacheEntry | null;
      } catch (err) {
        const msg = formatError(err);
        throw new Error(`PR cache get for ${repoSlug}/${branch} failed: ${msg}`, { cause: err });
      }
    },
    async upsert(entry) {
      try {
        await upsertGithubPrCache(db, entry);
      } catch (err) {
        const msg = formatError(err);
        throw new Error(`PR cache upsert for ${entry.repoSlug}/${entry.branch} failed: ${msg}`, {
          cause: err,
        });
      }
    },
    async invalidate(repoSlug, branch) {
      try {
        await deleteGithubPrCache(db, repoSlug, branch);
      } catch (err) {
        const msg = formatError(err);
        throw new Error(`PR cache invalidate for ${repoSlug}/${branch} failed: ${msg}`, {
          cause: err,
        });
      }
    },
  };
};
