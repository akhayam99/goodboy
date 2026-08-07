export const REPORT_ISSUE_REPO = 'akhayam99/goodboy';

const GITHUB_NEW_ISSUE_URL = `https://github.com/${REPORT_ISSUE_REPO}/issues/new`;

const MAX_FALLBACK_URL_BYTES = 4096;

const MAX_TITLE_URL_BYTES = 1024;

const TITLE_TRUNCATION_MARKER = '…';

const TRUNCATION_NOTICE =
  '\n\n[Notes truncated to fit the GitHub link. Finish writing after the issue opens.]';

const REPLACEMENT_CHAR = '�';

const SURROGATE_SCAN = /[\uD800-\uDBFF][\uDC00-\uDFFF]|([\uD800-\uDFFF])/g;

type BuildIssueBodyParams = {
  readonly version: string;
  readonly areaLabel: string;
  readonly notes: string;
};

export const buildIssueBody = ({ version, areaLabel, notes }: BuildIssueBodyParams): string =>
  `Area: ${areaLabel}\nVersion: ${version}\n\n${notes}`;

type SanitizeParams = {
  readonly text: string;
};

const withoutLoneSurrogates = ({ text }: SanitizeParams): string =>
  text.replace(SURROGATE_SCAN, (match: string, lone: string | undefined) =>
    lone == null ? match : REPLACEMENT_CHAR,
  );

type FallbackUrlParams = {
  readonly title: string;
  readonly body: string;
};

const buildFallbackIssueUrl = ({ title, body }: FallbackUrlParams): string =>
  `${GITHUB_NEW_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

const fitsFallbackUrl = ({ title, body }: FallbackUrlParams): boolean =>
  buildFallbackIssueUrl({ title, body }).length <= MAX_FALLBACK_URL_BYTES;

type CandidateParams = {
  readonly candidate: string;
};

type LongestFittingPrefixParams = {
  readonly text: string;
  readonly marker: string;
  readonly fits: (params: CandidateParams) => boolean;
};

const longestFittingPrefix = ({ text, marker, fits }: LongestFittingPrefixParams): string => {
  const codePoints = Array.from(text);
  let low = 0;
  let high = codePoints.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits({ candidate: `${codePoints.slice(0, mid).join('')}${marker}` })) {
      low = mid;
      continue;
    }
    high = mid - 1;
  }
  return `${codePoints.slice(0, low).join('')}${marker}`;
};

type CapFallbackTitleParams = {
  readonly title: string;
};

const capFallbackTitle = ({ title }: CapFallbackTitleParams): string => {
  if (encodeURIComponent(title).length <= MAX_TITLE_URL_BYTES) {
    return title;
  }
  return longestFittingPrefix({
    text: title,
    marker: TITLE_TRUNCATION_MARKER,
    fits: ({ candidate }) => encodeURIComponent(candidate).length <= MAX_TITLE_URL_BYTES,
  });
};

type BuildFallbackIssueParams = {
  readonly title: string;
  readonly version: string;
  readonly areaLabel: string;
  readonly notes: string;
};

type FallbackIssue = {
  readonly url: string;
  readonly title: string;
  readonly body: string;
  readonly titleTruncated: boolean;
  readonly notesTruncated: boolean;
};

export const buildFallbackIssue = ({
  title,
  version,
  areaLabel,
  notes,
}: BuildFallbackIssueParams): FallbackIssue => {
  const safeTitle = withoutLoneSurrogates({ text: title });
  const safeNotes = withoutLoneSurrogates({ text: notes });
  const fallbackTitle = capFallbackTitle({ title: safeTitle });
  const titleTruncated = fallbackTitle !== safeTitle;

  const fullBody = buildIssueBody({ version, areaLabel, notes: safeNotes });
  if (fitsFallbackUrl({ title: fallbackTitle, body: fullBody })) {
    return {
      url: buildFallbackIssueUrl({ title: fallbackTitle, body: fullBody }),
      title: fallbackTitle,
      body: fullBody,
      titleTruncated,
      notesTruncated: false,
    };
  }

  const truncatedNotes = longestFittingPrefix({
    text: safeNotes,
    marker: TRUNCATION_NOTICE,
    fits: ({ candidate }) =>
      fitsFallbackUrl({
        title: fallbackTitle,
        body: buildIssueBody({ version, areaLabel, notes: candidate }),
      }),
  });
  const truncatedBody = buildIssueBody({ version, areaLabel, notes: truncatedNotes });
  return {
    url: buildFallbackIssueUrl({ title: fallbackTitle, body: truncatedBody }),
    title: fallbackTitle,
    body: truncatedBody,
    titleTruncated,
    notesTruncated: true,
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
