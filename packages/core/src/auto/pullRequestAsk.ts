import { isRecord } from '@goodboy/types/helpers';
import { sha256Hex } from '../slug/sha256';

type PullRequestAskState = 'awaiting_confirm' | 'opening' | 'opened' | 'declined' | 'failed';

export type ResultPullRequest = Readonly<{
  state: PullRequestAskState;
  mountId: string;
  grantId: string;
  textVersion: string;
  title: string | null;
  body: string | null;
  number: number | null;
  url: string | null;
  message: string | null;
  startedAt: number | null;
}>;

const STATES: ReadonlyArray<PullRequestAskState> = [
  'awaiting_confirm',
  'opening',
  'opened',
  'declined',
  'failed',
];

type VersionParams = {
  readonly attemptId: string;
  readonly title: string | null;
  readonly body: string | null;
};

export const pullRequestTextVersionOf = ({ attemptId, title, body }: VersionParams): string =>
  `${attemptId}:${sha256Hex(JSON.stringify([title, body])).slice(0, 16)}`;

type ValueParams = {
  readonly value: unknown;
};

const exactTextOf = ({ value }: ValueParams): string | null =>
  typeof value === 'string' ? value : null;

const finiteOf = ({ value }: ValueParams): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

type ResultParams = {
  readonly result: unknown;
};

export const pullRequestOfResult = ({ result }: ResultParams): ResultPullRequest | null => {
  if (!isRecord(result) || !isRecord(result['verified'])) {
    return null;
  }
  const raw = result['verified']['pullRequest'];
  if (!isRecord(raw)) {
    return null;
  }
  const state = STATES.find((candidate) => candidate === raw['state']);
  const mountId = exactTextOf({ value: raw['mountId'] });
  const grantId = exactTextOf({ value: raw['grantId'] });
  const textVersion = exactTextOf({ value: raw['textVersion'] });
  if (state === undefined || mountId === null || grantId === null || textVersion === null) {
    return null;
  }
  return {
    state,
    mountId,
    grantId,
    textVersion,
    title: exactTextOf({ value: raw['title'] }),
    body: exactTextOf({ value: raw['body'] }),
    number: finiteOf({ value: raw['number'] }),
    url: exactTextOf({ value: raw['url'] }),
    message: exactTextOf({ value: raw['message'] }),
    startedAt: finiteOf({ value: raw['startedAt'] }),
  };
};

type TextParams = {
  readonly pullRequest: ResultPullRequest;
};

export const pullRequestAskTextOf = ({ pullRequest }: TextParams): string => {
  const title = pullRequest.title ?? 'the pull request';
  switch (pullRequest.state) {
    case 'awaiting_confirm':
      return `The pull request waits for you to open it: ${title}`;
    case 'opening':
      return `Opening the pull request: ${title}`;
    case 'opened':
      return pullRequest.number === null || pullRequest.url === null
        ? `Pull request is open: ${title}`
        : `Pull request #${pullRequest.number} is open: ${pullRequest.url}`;
    case 'declined':
      return `Not opened yet, the text is kept: ${title}`;
    case 'failed':
      return `The pull request was not opened: ${pullRequest.message ?? 'the host did not answer'}`;
    default: {
      const exhaustive: never = pullRequest.state;
      return exhaustive;
    }
  }
};
