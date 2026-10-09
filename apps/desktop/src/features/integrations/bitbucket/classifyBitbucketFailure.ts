import { PullRequestPortError, type PullRequestFailureKind } from '@goodboy/core';
import { CommandError } from '../../../shared/lib/invokeCommand';

type BitbucketFailureReason = 'bad_credentials' | 'denied' | 'rate_limited' | 'network' | 'failed';

type BitbucketFailure = Readonly<{
  reason: BitbucketFailureReason;
  message: string;
  detail: string;
}>;

type Params = Readonly<{
  status: number;
  body: string;
}>;

const BAD_CREDENTIALS_MESSAGE = 'Check the email and API token';
const DENIED_MESSAGE = 'The API token lacks the pull request scope';
const RATE_LIMITED_MESSAGE = 'Bitbucket is limiting requests, try again in a minute';
const NETWORK_MESSAGE = 'Bitbucket did not answer, check the connection';

const KIND_OF_REASON: Readonly<Record<BitbucketFailureReason, PullRequestFailureKind>> = {
  bad_credentials: 'denied',
  denied: 'denied',
  rate_limited: 'rate_limited',
  network: 'network',
  failed: 'failed',
};

const hostTextOf = ({ body }: { readonly body: string }): string => {
  try {
    const parsed: unknown = JSON.parse(body);
    const error: unknown =
      typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'error') : null;
    if (typeof error !== 'object' || error === null) {
      return body.trim();
    }
    const message: unknown = Reflect.get(error, 'message');
    const detail: unknown = Reflect.get(error, 'detail');
    return [message, detail]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join(': ');
  } catch {
    return body.trim();
  }
};

const classifyBitbucketFailure = ({ status, body }: Params): BitbucketFailure => {
  const detail = hostTextOf({ body });
  if (status === 401) {
    return { reason: 'bad_credentials', message: BAD_CREDENTIALS_MESSAGE, detail };
  }
  if (status === 403) {
    return { reason: 'denied', message: DENIED_MESSAGE, detail };
  }
  if (status === 429) {
    return { reason: 'rate_limited', message: RATE_LIMITED_MESSAGE, detail };
  }
  if (status === 0) {
    return { reason: 'network', message: NETWORK_MESSAGE, detail };
  }
  return {
    reason: 'failed',
    message: detail === '' ? `Bitbucket answered ${status}` : detail,
    detail,
  };
};

const HTTP_MESSAGE = /^http error (\d+): ([\s\S]*)$/;

const STATUS_BY_KIND: Readonly<Record<string, number>> = {
  auth: 401,
  no_token: 401,
  forbidden: 403,
  not_found: 404,
  timeout: 0,
};

const targetOf = ({ error }: { readonly error: CommandError }): Params => {
  const known = STATUS_BY_KIND[error.kind];
  if (known !== undefined) {
    return { status: known, body: error.message };
  }
  const http = HTTP_MESSAGE.exec(error.message);
  if (error.kind === 'http' && http !== null) {
    return { status: Number(http[1]), body: http[2] ?? '' };
  }
  return { status: 500, body: error.message };
};

export const bitbucketFailureOf = ({
  error,
}: {
  readonly error: unknown;
}): PullRequestPortError => {
  if (error instanceof PullRequestPortError) {
    return error;
  }
  const failure =
    error instanceof CommandError
      ? classifyBitbucketFailure(targetOf({ error }))
      : classifyBitbucketFailure({
          status: 500,
          body: error instanceof Error ? error.message : String(error),
        });
  return new PullRequestPortError({
    kind: KIND_OF_REASON[failure.reason],
    message: failure.message,
    details: failure.detail,
  });
};
