const GITHUB_URL_PREFIX = 'https://github.com/';

type ParseIssueCreateResultParams = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type IssueCreateResult =
  | { readonly ok: true; readonly url: string | null }
  | { readonly ok: false; readonly message: string };

export const parseIssueCreateResult = ({
  stdout,
  stderr,
  exitCode,
}: ParseIssueCreateResultParams): IssueCreateResult => {
  if (exitCode !== 0) {
    return { ok: false, message: stderr.trim() || `gh issue create exited with ${exitCode}` };
  }
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const lastLine = lines[lines.length - 1];
  if (lastLine != null && lastLine.startsWith(GITHUB_URL_PREFIX)) {
    return { ok: true, url: lastLine };
  }
  return { ok: true, url: null };
};
