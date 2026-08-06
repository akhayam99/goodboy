import type { SessionExternalTaskProvider } from '@goodboy/types';
import { slackThreadExternalId } from '../../../../../integrations/slack/threadFormulas';

type Params = {
  readonly provider: SessionExternalTaskProvider;
  readonly rawUrl: string;
};

type ParsedIntegrationTaskUrl = Readonly<{
  externalId: string;
  identifier: string;
  title: string;
  url: string;
}>;

type ProviderParams = {
  readonly segments: ReadonlyArray<string>;
  readonly searchParams: URLSearchParams;
};

type ParseProviderParams = ProviderParams & {
  readonly provider: SessionExternalTaskProvider;
};

type DecodeParams = {
  readonly value: string;
};

type FallbackParams = {
  readonly rawUrl: string;
};

type ProviderResult = Readonly<{
  externalId: string;
  identifier: string;
}> | null;

const parseLinear = ({ segments }: ProviderParams): ProviderResult => {
  const issueIndex = segments.findIndex((segment) => segment.toLowerCase() === 'issue');
  const identifier = segments[issueIndex + 1];
  if (issueIndex < 0 || identifier == null || identifier === '') {
    return null;
  }
  return { externalId: identifier, identifier };
};

const parseSentry = ({ segments }: ProviderParams): ProviderResult => {
  const issueIndex = segments.findIndex((segment) => segment.toLowerCase() === 'issues');
  const identifier = segments[issueIndex + 1];
  if (issueIndex < 0 || identifier == null || identifier === '') {
    return null;
  }
  return { externalId: identifier, identifier };
};

const parseGitlab = ({ segments }: ProviderParams): ProviderResult => {
  const issueIndex = segments.findIndex(
    (segment, index) =>
      segment.toLowerCase() === 'issues' && index > 0 && segments[index - 1] === '-',
  );
  const issueNumber = segments[issueIndex + 1];
  if (issueIndex < 2 || issueNumber == null || issueNumber === '') {
    return null;
  }
  const projectPath = segments.slice(0, issueIndex - 1).join('/');
  const identifier = `${projectPath}#${issueNumber}`;
  return { externalId: identifier, identifier };
};

const parseJira = ({ segments }: ProviderParams): ProviderResult => {
  const browseIndex = segments.findIndex((segment) => segment.toLowerCase() === 'browse');
  const issueKey = segments[browseIndex + 1];
  if (browseIndex < 0 || issueKey == null || issueKey === '') {
    return null;
  }
  return { externalId: issueKey, identifier: issueKey };
};

const parseGithub = ({ segments }: ProviderParams): ProviderResult => {
  const issueIndex = segments.findIndex((segment) => segment.toLowerCase() === 'issues');
  const issueNumber = segments[issueIndex + 1];
  if (issueIndex < 2 || issueNumber == null || issueNumber === '') {
    return null;
  }
  return { externalId: issueNumber, identifier: `#${issueNumber}` };
};

const parseBitbucket = ({ segments }: ProviderParams): ProviderResult => {
  const pullRequestIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === 'pull-requests',
  );
  const pullRequestId = segments[pullRequestIndex + 1];
  if (pullRequestIndex !== 2 || pullRequestId == null || !/^\d+$/.test(pullRequestId)) {
    return null;
  }
  const identifier = `${segments[0]}/${segments[1]}#${pullRequestId}`;
  return { externalId: identifier, identifier };
};

const SLACK_TS_TAIL = 6;

type PermalinkSegmentParams = {
  readonly segment: string;
};

const slackTsFromPermalinkSegment = ({ segment }: PermalinkSegmentParams): string | null => {
  const match = /^p(\d+)$/.exec(segment);
  const digits = match?.[1];
  if (digits == null || digits.length <= SLACK_TS_TAIL) {
    return null;
  }
  return `${digits.slice(0, digits.length - SLACK_TS_TAIL)}.${digits.slice(-SLACK_TS_TAIL)}`;
};

const parseSlack = ({ segments, searchParams }: ProviderParams): ProviderResult => {
  const archivesIndex = segments.findIndex((segment) => segment.toLowerCase() === 'archives');
  const channelId = segments[archivesIndex + 1];
  const messageSegment = segments[archivesIndex + 2];
  if (archivesIndex < 0 || channelId == null || channelId === '' || messageSegment == null) {
    return null;
  }
  const parentTs = searchParams.get('thread_ts');
  const threadTs =
    parentTs != null && parentTs !== ''
      ? parentTs
      : slackTsFromPermalinkSegment({ segment: messageSegment });
  if (threadTs == null) {
    return null;
  }
  return {
    externalId: slackThreadExternalId({ channelId, threadTs }),
    identifier: `#${channelId}`,
  };
};

const parseProvider = ({
  provider,
  segments,
  searchParams,
}: ParseProviderParams): ProviderResult => {
  switch (provider) {
    case 'linear':
      return parseLinear({ segments, searchParams });
    case 'sentry':
      return parseSentry({ segments, searchParams });
    case 'gitlab':
      return parseGitlab({ segments, searchParams });
    case 'jira':
      return parseJira({ segments, searchParams });
    case 'github':
      return parseGithub({ segments, searchParams });
    case 'bitbucket':
      return parseBitbucket({ segments, searchParams });
    case 'slack':
      return parseSlack({ segments, searchParams });
    default: {
      const exhaustiveProvider: never = provider;
      return exhaustiveProvider;
    }
  }
};

const decodeSegment = ({ value }: DecodeParams): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const fallbackIdentifier = ({ rawUrl }: FallbackParams): string => {
  const path = rawUrl.split(/[?#]/)[0] ?? rawUrl;
  const segments = path.split('/').filter((segment) => segment !== '');
  const trailingSegment = segments.at(-1) ?? rawUrl;
  return decodeSegment({ value: trailingSegment });
};

export const parseIntegrationTaskUrl = ({
  provider,
  rawUrl,
}: Params): ParsedIntegrationTaskUrl | null => {
  const trimmedUrl = rawUrl.trim();
  if (trimmedUrl === '') {
    return null;
  }

  try {
    const normalizedUrl = trimmedUrl.includes('://') ? trimmedUrl : `https://${trimmedUrl}`;
    const parsedUrl = new URL(normalizedUrl);
    const segments = parsedUrl.pathname
      .split('/')
      .filter((segment) => segment !== '')
      .map((segment) => decodeSegment({ value: segment }));
    const providerResult = parseProvider({
      provider,
      segments,
      searchParams: parsedUrl.searchParams,
    });
    const identifier = providerResult?.identifier ?? segments.at(-1) ?? parsedUrl.hostname;
    return {
      externalId: providerResult?.externalId ?? parsedUrl.toString(),
      identifier,
      title: identifier,
      url: parsedUrl.toString(),
    };
  } catch {
    const identifier = fallbackIdentifier({ rawUrl: trimmedUrl });
    return {
      externalId: trimmedUrl,
      identifier,
      title: identifier,
      url: trimmedUrl,
    };
  }
};
