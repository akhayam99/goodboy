export const REPORT_ISSUE_REPO = 'akhayam99/goodboy';

const GITHUB_NEW_ISSUE_URL = `https://github.com/${REPORT_ISSUE_REPO}/issues/new`;

export const MAX_ISSUE_URL_BYTES = 4096;

const MAX_TITLE_URL_BYTES = 1024;

const TITLE_TRUNCATION_MARKER = '…';

const REPLACEMENT_CHAR = '�';

const SURROGATE_SCAN = /[\uD800-\uDBFF][\uDC00-\uDFFF]|([\uD800-\uDFFF])/g;

type SanitizeParams = {
  readonly text: string;
};

export const withoutLoneSurrogates = ({ text }: SanitizeParams): string =>
  text.replace(SURROGATE_SCAN, (match: string, lone: string | undefined) =>
    lone == null ? match : REPLACEMENT_CHAR,
  );

type IssueUrlParams = {
  readonly title: string;
  readonly body: string;
};

export const buildIssueUrl = ({ title, body }: IssueUrlParams): string =>
  `${GITHUB_NEW_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

export const fitsIssueUrl = ({ title, body }: IssueUrlParams): boolean =>
  buildIssueUrl({ title, body }).length <= MAX_ISSUE_URL_BYTES;

type CandidateParams = {
  readonly candidate: string;
};

type LongestFittingPrefixParams = {
  readonly text: string;
  readonly marker: string;
  readonly fits: (params: CandidateParams) => boolean;
};

export const longestFittingPrefix = ({
  text,
  marker,
  fits,
}: LongestFittingPrefixParams): string => {
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

type CapIssueTitleParams = {
  readonly title: string;
};

export const capIssueTitle = ({ title }: CapIssueTitleParams): string => {
  if (encodeURIComponent(title).length <= MAX_TITLE_URL_BYTES) {
    return title;
  }
  return longestFittingPrefix({
    text: title,
    marker: TITLE_TRUNCATION_MARKER,
    fits: ({ candidate }) => encodeURIComponent(candidate).length <= MAX_TITLE_URL_BYTES,
  });
};
