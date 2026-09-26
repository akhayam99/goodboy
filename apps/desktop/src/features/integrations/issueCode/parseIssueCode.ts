export type IssueCodeUrl =
  | { readonly provider: 'linear'; readonly identifier: string }
  | { readonly provider: 'jira'; readonly key: string; readonly host: string }
  | { readonly provider: 'github'; readonly repo: string; readonly number: number }
  | {
      readonly provider: 'gitlab';
      readonly host: string;
      readonly projectPath: string;
      readonly iid: number;
    }
  | { readonly provider: 'sentry'; readonly issueId: string };

export type ParsedIssueCode =
  | { readonly kind: 'text' }
  | {
      readonly kind: 'key';
      readonly code: string;
      readonly prefix: string;
      readonly number: number;
    }
  | { readonly kind: 'shortId'; readonly code: string; readonly prefix: string }
  | { readonly kind: 'number'; readonly number: number }
  | {
      readonly kind: 'slugNumber';
      readonly slug: string;
      readonly number: number;
      readonly host: 'github-or-gitlab' | 'gitlab';
    }
  | { readonly kind: 'url'; readonly url: IssueCodeUrl };

const TEXT: ParsedIssueCode = { kind: 'text' };

const CODE_PATTERN = /^([A-Z][A-Z0-9_]*(?:-[A-Z][A-Z0-9_]*)*)-([A-Z0-9]+)$/;
const NUMBER_PATTERN = /^#(\d+)$/;
const SLUG_NUMBER_PATTERN = /^([\w.-]+(?:\/[\w.-]+)+)#(\d+)$/;

const parseUrl = (raw: string): IssueCodeUrl | null => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter((part) => part !== '');
  const host = url.hostname.toLowerCase();
  if (host === 'linear.app') {
    const index = parts.indexOf('issue');
    const identifier = index >= 0 ? parts[index + 1] : undefined;
    return identifier === undefined
      ? null
      : { provider: 'linear', identifier: identifier.toUpperCase() };
  }
  if (host.endsWith('.atlassian.net')) {
    const index = parts.indexOf('browse');
    const key = index >= 0 ? parts[index + 1] : undefined;
    return key === undefined ? null : { provider: 'jira', key: key.toUpperCase(), host };
  }
  if (host === 'github.com') {
    const [owner, repo, section, number] = parts;
    if (owner === undefined || repo === undefined || section !== 'issues' || number === undefined) {
      return null;
    }
    const parsed = Number.parseInt(number, 10);
    return Number.isNaN(parsed)
      ? null
      : { provider: 'github', repo: `${owner}/${repo}`, number: parsed };
  }
  if (host === 'sentry.io' || host.endsWith('.sentry.io')) {
    const index = parts.indexOf('issues');
    const issueId = index >= 0 ? parts[index + 1] : undefined;
    return issueId === undefined || !/^\d+$/.test(issueId) ? null : { provider: 'sentry', issueId };
  }
  const dash = parts.indexOf('-');
  if (dash > 0 && parts[dash + 1] === 'issues' && parts[dash + 2] !== undefined) {
    const iid = Number.parseInt(parts[dash + 2] ?? '', 10);
    return Number.isNaN(iid)
      ? null
      : { provider: 'gitlab', host, projectPath: parts.slice(0, dash).join('/'), iid };
  }
  return null;
};

export const parseIssueCode = (input: string): ParsedIssueCode => {
  const raw = input.trim();
  if (raw === '') {
    return TEXT;
  }
  const lowered = raw.toLowerCase();
  if (lowered.startsWith('http://') || lowered.startsWith('https://')) {
    const url = parseUrl(raw);
    return url === null ? TEXT : { kind: 'url', url };
  }
  const numberMatch = NUMBER_PATTERN.exec(raw);
  if (numberMatch?.[1] !== undefined) {
    return { kind: 'number', number: Number.parseInt(numberMatch[1], 10) };
  }
  const slugMatch = SLUG_NUMBER_PATTERN.exec(raw);
  if (slugMatch?.[1] !== undefined && slugMatch[2] !== undefined) {
    const slug = slugMatch[1];
    return {
      kind: 'slugNumber',
      slug,
      number: Number.parseInt(slugMatch[2], 10),
      host: slug.split('/').length > 2 ? 'gitlab' : 'github-or-gitlab',
    };
  }
  const code = raw.toUpperCase();
  const codeMatch = CODE_PATTERN.exec(code);
  if (codeMatch?.[1] === undefined || codeMatch[2] === undefined) {
    return TEXT;
  }
  const prefix = codeMatch[1];
  const suffix = codeMatch[2];
  if (/^\d+$/.test(suffix)) {
    return { kind: 'key', code, prefix, number: Number.parseInt(suffix, 10) };
  }
  return { kind: 'shortId', code, prefix };
};
