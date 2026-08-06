export const REPORT_ISSUE_REPO = 'akhayam99/goodboy';

const GITHUB_NEW_ISSUE_URL = `https://github.com/${REPORT_ISSUE_REPO}/issues/new`;

const MAX_FALLBACK_URL_BYTES = 4096;

const TRUNCATION_NOTICE =
  '\n\n[Notes truncated to fit the GitHub link. Finish writing after the issue opens.]';

type BuildIssueBodyParams = {
  readonly version: string;
  readonly areaLabel: string;
  readonly notes: string;
};

export const buildIssueBody = ({ version, areaLabel, notes }: BuildIssueBodyParams): string =>
  `Area: ${areaLabel}\nVersion: ${version}\n\n${notes}`;

type BuildFallbackIssueUrlParams = {
  readonly title: string;
  readonly body: string;
};

export const buildFallbackIssueUrl = ({ title, body }: BuildFallbackIssueUrlParams): string =>
  `${GITHUB_NEW_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

type BuildFallbackIssueParams = {
  readonly title: string;
  readonly version: string;
  readonly areaLabel: string;
  readonly notes: string;
};

export type FallbackIssue = {
  readonly url: string;
  readonly body: string;
  readonly truncated: boolean;
};

const fitsFallbackUrl = ({ title, body }: BuildFallbackIssueUrlParams): boolean =>
  buildFallbackIssueUrl({ title, body }).length <= MAX_FALLBACK_URL_BYTES;

export const buildFallbackIssue = ({
  title,
  version,
  areaLabel,
  notes,
}: BuildFallbackIssueParams): FallbackIssue => {
  const fullBody = buildIssueBody({ version, areaLabel, notes });
  if (fitsFallbackUrl({ title, body: fullBody })) {
    return {
      url: buildFallbackIssueUrl({ title, body: fullBody }),
      body: fullBody,
      truncated: false,
    };
  }

  const codePoints = Array.from(notes);
  let low = 0;
  let high = codePoints.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidateBody = buildIssueBody({
      version,
      areaLabel,
      notes: `${codePoints.slice(0, mid).join('')}${TRUNCATION_NOTICE}`,
    });
    if (fitsFallbackUrl({ title, body: candidateBody })) {
      low = mid;
      continue;
    }
    high = mid - 1;
  }

  const truncatedBody = buildIssueBody({
    version,
    areaLabel,
    notes: `${codePoints.slice(0, low).join('')}${TRUNCATION_NOTICE}`,
  });
  return {
    url: buildFallbackIssueUrl({ title, body: truncatedBody }),
    body: truncatedBody,
    truncated: true,
  };
};

const FORBIDDEN_URL_CHARS = new Set(['"', '<', '>', '`', '|', '\\', '^', '{', '}']);

const isControlOrWhitespace = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  if (code <= 0x1f || code === 0x7f) {
    return true;
  }
  return /\s/.test(char);
};

export const isOpenableUrl = (url: string): boolean => {
  if (url.length === 0 || url.length > MAX_FALLBACK_URL_BYTES) {
    return false;
  }
  const lower = url.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return false;
  }
  return !Array.from(url).some(
    (char) => FORBIDDEN_URL_CHARS.has(char) || isControlOrWhitespace(char),
  );
};
