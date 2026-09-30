import { invoke } from '@tauri-apps/api/core';
import { formatError } from '@goodboy/ui';
import {
  createIssueComment,
  detectRepoSlug,
  ghRunJson,
  listAssignedIssues,
  listInboxPullRequests,
  listIssueComments,
  updateIssueBody,
} from '@goodboy/core';
import type { GhRunner, GhResult, GhRunOptions } from '@goodboy/core';
import type {
  GhTokenStatus,
  GithubInboxPullRequest,
  GithubIssue,
  GithubIssueComment,
} from '@goodboy/types';

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
  projectId?: string,
): Promise<string> => {
  try {
    return await invoke<string>('gh_pr_diff', {
      repo,
      pr,
      cwd,
      workspaceId,
      ...(projectId != null ? { projectId } : {}),
    });
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`PR diff fetch for ${repo}#${pr} failed: ${msg}`, { cause: err });
  }
};

type GitPushParams = {
  readonly cwd: string;
  readonly branch: string | null;
  readonly workspaceId?: string;
  readonly projectId?: string;
  readonly sha?: string;
};

export const gitPush = async ({
  cwd,
  branch,
  workspaceId,
  projectId,
  sha,
}: GitPushParams): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  try {
    const raw = await invoke<RawGhRunResult>('git_push', {
      cwd,
      branch: branch ?? undefined,
      ...(sha !== undefined ? { sha } : {}),
      workspaceId,
      ...(projectId != null ? { projectId } : {}),
    });
    return { stdout: raw.stdout, stderr: raw.stderr, exitCode: raw.exitCode };
  } catch (err) {
    const msg = formatError(err);
    throw new Error(`git push failed: ${msg}`, { cause: err });
  }
};

export const ghAssignedIssues = async (
  slug: string,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<GithubIssue>> => listAssignedIssues(tauriGhRunner, slug, opts);

export const ghInboxPullRequests = async (
  slug: string,
  opts: GhRunOptions = {},
): Promise<ReadonlyArray<GithubInboxPullRequest>> =>
  listInboxPullRequests({ runner: tauriGhRunner, repoSlug: slug, now: new Date(), opts });

const ISSUE_VIEW_FIELDS = 'number,title,body,url,state,labels,author,updatedAt';

type RawGithubIssueView = {
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: string;
  labels: ReadonlyArray<{ name: string }>;
  author: { login: string } | null;
  updatedAt: string;
};

export const ghIssueByNumber = async (
  cwd: string,
  issueNumber: number,
  workspaceId?: string,
): Promise<GithubIssue> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (slug == null) {
    throw new Error('could not detect a GitHub repository for this project');
  }
  return ghIssueInRepo({ repo: slug, issueNumber, cwd, workspaceId });
};

type IssueInRepoParams = {
  readonly repo: string;
  readonly issueNumber: number;
  readonly cwd?: string;
  readonly workspaceId?: string;
};

export const ghIssueInRepo = async ({
  repo,
  issueNumber,
  cwd,
  workspaceId,
}: IssueInRepoParams): Promise<GithubIssue> => {
  const raw = await ghRunJson<RawGithubIssueView>({
    runner: tauriGhRunner,
    args: ['issue', 'view', String(issueNumber), '--repo', repo, '--json', ISSUE_VIEW_FIELDS],
    opts: {
      ...(cwd === undefined ? {} : { cwd }),
      ...(workspaceId === undefined ? {} : { workspaceId }),
    },
    shape: 'object',
  });
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    url: raw.url,
    state: raw.state,
    labels: raw.labels.map((label) => label.name),
    updatedAt: raw.updatedAt,
    author: raw.author?.login ?? null,
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
    throw new Error('could not detect a GitHub repository for this project');
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
    throw new Error('could not detect a GitHub repository for this project');
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
    throw new Error('could not detect a GitHub repository for this project');
  }
  return createIssueComment({
    runner: tauriGhRunner,
    repoSlug: slug,
    issueNumber,
    body,
    opts: { cwd, workspaceId },
  });
};

export const ghBaseBranches = async (
  cwd: string,
  workspaceId?: string,
  projectId?: string,
): Promise<{ defaultBranch: string | null; branches: ReadonlyArray<string> }> => {
  const [def, list] = await Promise.all([
    tauriGhRunner.run(
      ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'],
      {
        cwd,
        workspaceId,
        projectId,
      },
    ),
    tauriGhRunner.run(['api', 'repos/{owner}/{repo}/branches?per_page=100', '--jq', '.[].name'], {
      cwd,
      workspaceId,
      projectId,
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
  projectId?: string,
): Promise<ReadonlyArray<string>> => {
  const res = await tauriGhRunner.run(
    ['api', 'repos/{owner}/{repo}/collaborators?per_page=100', '--jq', '.[].login'],
    { cwd, workspaceId, projectId },
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
        ...(opts.projectId != null ? { projectId: opts.projectId } : {}),
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

type RepoDeletesMergedBranchesParams = {
  readonly cwd: string;
  readonly workspaceId?: string;
};

export const ghRepoDeletesMergedBranches = async ({
  cwd,
  workspaceId,
}: RepoDeletesMergedBranchesParams): Promise<boolean | null> => {
  const slug = await detectRepoSlug(tauriGhRunner, cwd, workspaceId);
  if (slug == null) {
    return null;
  }
  const res = await tauriGhRunner.run(['api', `repos/${slug}`, '--jq', '.delete_branch_on_merge'], {
    cwd,
    ...(workspaceId === undefined ? {} : { workspaceId }),
  });
  if (res.exitCode !== 0) {
    return null;
  }
  const value = res.stdout.trim();
  if (value === 'true') {
    return true;
  }
  return value === 'false' ? false : null;
};
