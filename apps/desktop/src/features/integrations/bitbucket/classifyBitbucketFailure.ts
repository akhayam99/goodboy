import { PullRequestPortError } from '@goodboy/core';
import { CommandError } from '../../../shared/lib/invokeCommand';
import type { HostFailureKind } from '../../../shared/lib/hostFailure';
import { pullRequestFailureKindOf } from '../../../shared/lib/pullRequestFailureKindOf';
import { staleHeadErrorOf } from '../../../shared/lib/staleHeadErrorOf';

type BitbucketFailure = Readonly<{
  kind: HostFailureKind;
  status: number | null;
  retryAfterSeconds: number | null;
  detail: string;
}>;

const BAD_CREDENTIALS_MESSAGE = 'Check the email and API token';
const DENIED_MESSAGE = 'The API token lacks the pull request scope';
const NETWORK_MESSAGE = 'Bitbucket did not answer, check the connection';

type BodyParams = {
  readonly body: string;
};

type RetryParams = {
  readonly retryAfterSeconds: number | null;
};

type ErrorParams = {
  readonly error: unknown;
};

type FailureParams = {
  readonly failure: BitbucketFailure;
};

const hostTextOf = ({ body }: BodyParams): string => {
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

const rateLimitedMessageOf = ({ retryAfterSeconds }: RetryParams): string =>
  retryAfterSeconds === null
    ? 'Bitbucket is limiting requests, try again in a minute'
    : `Bitbucket is limiting requests, try again in ${retryAfterSeconds} seconds`;

const failureOf = ({ error }: ErrorParams): BitbucketFailure => {
  if (error instanceof CommandError) {
    const failure = error.failure;
    return {
      kind: failure?.kind ?? 'failed',
      status: failure?.status ?? null,
      retryAfterSeconds: failure?.retryAfterSeconds ?? null,
      detail: hostTextOf({ body: failure?.detail ?? error.message }),
    };
  }
  return {
    kind: 'failed',
    status: null,
    retryAfterSeconds: null,
    detail: hostTextOf({ body: error instanceof Error ? error.message : String(error) }),
  };
};

const messageOf = ({ failure }: FailureParams): string => {
  switch (failure.kind) {
    case 'bad_credentials':
      return BAD_CREDENTIALS_MESSAGE;
    case 'denied':
      return DENIED_MESSAGE;
    case 'rate_limited':
      return rateLimitedMessageOf({ retryAfterSeconds: failure.retryAfterSeconds });
    case 'network':
    case 'timeout':
      return NETWORK_MESSAGE;
    case 'not_found':
    case 'failed':
      if (failure.detail !== '') {
        return failure.detail;
      }
      return failure.status === null
        ? 'Bitbucket did not answer'
        : `Bitbucket answered ${failure.status}`;
    default: {
      const exhaustive: never = failure.kind;
      return exhaustive;
    }
  }
};

export const bitbucketFailureOf = ({ error }: ErrorParams): PullRequestPortError => {
  if (error instanceof PullRequestPortError) {
    return error;
  }
  const stale = staleHeadErrorOf({ error });
  if (stale !== null) {
    return stale;
  }
  const failure = failureOf({ error });
  return new PullRequestPortError({
    kind: pullRequestFailureKindOf({ kind: failure.kind }),
    message: messageOf({ failure }),
    details: failure.detail,
  });
};
