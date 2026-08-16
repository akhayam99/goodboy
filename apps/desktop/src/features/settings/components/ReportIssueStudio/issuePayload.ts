import {
  buildIssueUrl,
  capIssueTitle,
  fitsIssueUrl,
  longestFittingPrefix,
  MAX_ISSUE_URL_BYTES,
  withoutLoneSurrogates,
} from '../../issueUrl';

const TRUNCATION_NOTICE =
  '\n\n[Notes truncated to fit the GitHub link. Finish writing after the issue opens.]';

type BuildIssueBodyParams = {
  readonly typeLabel: string;
  readonly version: string;
  readonly areaLabel: string;
  readonly notes: string;
  readonly imageNames?: ReadonlyArray<string>;
};

export const buildIssueBody = ({
  typeLabel,
  version,
  areaLabel,
  notes,
  imageNames = [],
}: BuildIssueBodyParams): string => {
  const head = `Type: ${typeLabel}\nArea: ${areaLabel}\nVersion: ${version}\n\n${notes}`;
  if (imageNames.length === 0) {
    return head;
  }
  return `${head}\n\nScreenshots to drag into this issue: ${imageNames.join(', ')}`;
};

type BuildFallbackIssueParams = {
  readonly title: string;
  readonly typeLabel: string;
  readonly version: string;
  readonly areaLabel: string;
  readonly notes: string;
  readonly imageNames?: ReadonlyArray<string>;
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
  typeLabel,
  version,
  areaLabel,
  notes,
  imageNames = [],
}: BuildFallbackIssueParams): FallbackIssue => {
  const safeTitle = withoutLoneSurrogates({ text: title });
  const safeNotes = withoutLoneSurrogates({ text: notes });
  const fallbackTitle = capIssueTitle({ title: safeTitle });
  const titleTruncated = fallbackTitle !== safeTitle;

  const fullBody = buildIssueBody({ typeLabel, version, areaLabel, notes: safeNotes, imageNames });
  if (fitsIssueUrl({ title: fallbackTitle, body: fullBody })) {
    return {
      url: buildIssueUrl({ title: fallbackTitle, body: fullBody }),
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
      fitsIssueUrl({
        title: fallbackTitle,
        body: buildIssueBody({ typeLabel, version, areaLabel, notes: candidate, imageNames }),
      }),
  });
  const truncatedBody = buildIssueBody({
    typeLabel,
    version,
    areaLabel,
    notes: truncatedNotes,
    imageNames,
  });
  return {
    url: buildIssueUrl({ title: fallbackTitle, body: truncatedBody }),
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
  if (url.length === 0 || url.length > MAX_ISSUE_URL_BYTES) {
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
