import type { GhRunner } from '@goodboy/core';
import type { GhTokenStatus } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { redactReport } from '../../shared/utils/redactReport';
import { REPORT_ISSUE_REPO } from '../settings/issueUrl';

export type ReportFiled = {
  readonly url: string | null;
  readonly number: number | null;
  readonly kind: 'issue' | 'comment';
};

export type ReportSendResult =
  | { readonly ok: true; readonly filed: ReportFiled }
  | { readonly ok: false; readonly message: string };

type GithubModeParams = {
  readonly status: GhTokenStatus | null;
};

export const sendsDirectly = ({ status }: GithubModeParams): boolean =>
  status?.mode === 'gh-cli' || status?.mode === 'pat';

const GITHUB_URL_PREFIX = 'https://github.com/';

const ISSUE_NUMBER = /\/issues\/(\d+)/;

type LastUrlParams = {
  readonly stdout: string;
};

const lastGithubUrl = ({ stdout }: LastUrlParams): string | null => {
  const last = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);
  return last != null && last.startsWith(GITHUB_URL_PREFIX) ? last : null;
};

const issueNumber = ({ url }: { readonly url: string | null }): number | null => {
  const match = url == null ? null : ISSUE_NUMBER.exec(url);
  return match?.[1] == null ? null : Number(match[1]);
};

type RunParams = {
  readonly runner: GhRunner;
  readonly args: ReadonlyArray<string>;
  readonly kind: ReportFiled['kind'];
  readonly fallbackNumber: number | null;
};

const runFiling = async ({
  runner,
  args,
  kind,
  fallbackNumber,
}: RunParams): Promise<ReportSendResult> => {
  try {
    const result = await runner.run(args, {});
    if (result.exitCode !== 0) {
      const reported = result.stderr.trim();
      return {
        ok: false,
        message: reported === '' ? `gh exited with ${result.exitCode}` : reported,
      };
    }
    const url = lastGithubUrl({ stdout: result.stdout });
    return { ok: true, filed: { url, number: issueNumber({ url }) ?? fallbackNumber, kind } };
  } catch (err) {
    return { ok: false, message: formatError(err) };
  }
};

type FileIssueParams = {
  readonly runner: GhRunner;
  readonly title: string;
  readonly body: string;
};

export const fileReportIssue = ({ runner, title, body }: FileIssueParams) =>
  runFiling({
    runner,
    args: ['issue', 'create', '--repo', REPORT_ISSUE_REPO, '--title', title, '--body', body],
    kind: 'issue',
    fallbackNumber: null,
  });

type AddCommentParams = {
  readonly runner: GhRunner;
  readonly number: number;
  readonly body: string;
};

export const addReportComment = ({ runner, number, body }: AddCommentParams) =>
  runFiling({
    runner,
    args: ['issue', 'comment', String(number), '--repo', REPORT_ISSUE_REPO, '--body', body],
    kind: 'comment',
    fallbackNumber: number,
  });

export type SimilarIssue = {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly comments: number;
};

const toSimilarIssue = (raw: unknown): SimilarIssue | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const hit: Readonly<Record<string, unknown>> = { ...raw };
  if (
    typeof hit.number !== 'number' ||
    typeof hit.title !== 'string' ||
    typeof hit.url !== 'string'
  ) {
    return null;
  }
  return {
    number: hit.number,
    title: hit.title,
    url: hit.url,
    comments: typeof hit.commentsCount === 'number' ? hit.commentsCount : 0,
  };
};

const MIN_SEARCH_LENGTH = 12;

type FindSimilarParams = {
  readonly runner: GhRunner;
  readonly line: string;
};

export const findSimilarIssue = async ({
  runner,
  line,
}: FindSimilarParams): Promise<SimilarIssue | null> => {
  const query = redactReport({ text: line.trim() });
  if (query.length < MIN_SEARCH_LENGTH) {
    return null;
  }
  try {
    const result = await runner.run(
      [
        'search',
        'issues',
        query,
        '--repo',
        REPORT_ISSUE_REPO,
        '--state',
        'open',
        '--json',
        'number,title,url,commentsCount',
        '--limit',
        '1',
      ],
      {},
    );
    if (result.exitCode !== 0) {
      return null;
    }
    const parsed: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    return toSimilarIssue(parsed[0]);
  } catch {
    return null;
  }
};
