import { slugifyBranch } from '../../../shared/utils/slugifyBranch';

const TITLE_MAX_LEN = 32;
const SLUG_MAX_LEN = 48;

type TextParams = {
  readonly text: string;
};

export const slackThreadFirstLine = ({ text }: TextParams): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '') ?? '';

export const slackThreadTitle = ({ text }: TextParams): string => {
  const firstLine = slackThreadFirstLine({ text });
  if (firstLine.length <= TITLE_MAX_LEN) {
    return firstLine;
  }
  return `${firstLine.slice(0, TITLE_MAX_LEN).trimEnd()}…`;
};

type IdentifierParams = TextParams & {
  readonly channelName: string;
};

export const slackThreadIdentifier = ({ channelName, text }: IdentifierParams): string => {
  const title = slackThreadTitle({ text });
  if (title === '') {
    return `#${channelName}`;
  }
  return `#${channelName} › ${title}`;
};

type ExternalIdParams = {
  readonly channelId: string;
  readonly threadTs: string;
};

export const slackThreadExternalId = ({ channelId, threadTs }: ExternalIdParams): string =>
  `${channelId}:${threadTs}`;

type ParseExternalIdParams = {
  readonly externalId: string;
};

export const parseSlackThreadExternalId = ({
  externalId,
}: ParseExternalIdParams): ExternalIdParams | null => {
  const separator = externalId.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const channelId = externalId.slice(0, separator);
  const threadTs = externalId.slice(separator + 1);
  if (threadTs === '') {
    return null;
  }
  return { channelId, threadTs };
};

export const slackThreadBranchSlug = ({ text }: TextParams): string =>
  slugifyBranch({ input: slackThreadFirstLine({ text }), maxLength: SLUG_MAX_LEN });
