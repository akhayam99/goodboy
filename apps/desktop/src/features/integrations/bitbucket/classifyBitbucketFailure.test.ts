// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PullRequestPortError } from '@goodboy/core';
import type { HostFailureKind } from '../../../shared/lib/hostFailure';
import { CommandError } from '../../../shared/lib/invokeCommand';
import { bitbucketFailureOf } from './classifyBitbucketFailure';

type FailingParams = {
  readonly kind: HostFailureKind;
  readonly status: number | null;
  readonly detail: string;
  readonly retryAfterSeconds?: number;
};

const failing = ({ kind, status, detail, retryAfterSeconds }: FailingParams): CommandError =>
  new CommandError({
    kind: 'http',
    message: `http error ${status}: ${detail}`,
    failure: { kind, status, retryAfterSeconds: retryAfterSeconds ?? null, detail },
  });

const errorBody = (message: string, detail?: string): string =>
  JSON.stringify({
    type: 'error',
    error: { message, ...(detail === undefined ? {} : { detail }) },
  });

describe('bitbucketFailureOf', () => {
  it.each([
    [
      'bad credentials',
      failing({ kind: 'bad_credentials', status: 401, detail: 'authentication failed: x' }),
      'denied',
      'Check the email and API token',
    ],
    [
      'denied',
      failing({ kind: 'denied', status: 403, detail: 'forbidden: x' }),
      'denied',
      'The API token lacks the pull request scope',
    ],
    [
      'rate limited',
      failing({ kind: 'rate_limited', status: 429, detail: errorBody('Too many requests') }),
      'rate_limited',
      'Bitbucket is limiting requests, try again in a minute',
    ],
    [
      'network',
      failing({ kind: 'network', status: 0, detail: 'connection refused' }),
      'network',
      'Bitbucket did not answer, check the connection',
    ],
    [
      'timeout',
      failing({ kind: 'timeout', status: null, detail: 'request timed out: 30s' }),
      'network',
      'Bitbucket did not answer, check the connection',
    ],
    [
      'no credential',
      failing({ kind: 'bad_credentials', status: null, detail: 'no personal API key stored' }),
      'denied',
      'Check the email and API token',
    ],
  ] as const)('%s', (_label, error, kind, message) => {
    const failure = bitbucketFailureOf({ error });
    expect(failure).toBeInstanceOf(PullRequestPortError);
    expect(failure.kind).toBe(kind);
    expect(failure.message).toBe(message);
  });

  it('tells how long to wait when the host sent a retry hint', () => {
    const failure = bitbucketFailureOf({
      error: failing({ kind: 'rate_limited', status: 429, detail: '{}', retryAfterSeconds: 42 }),
    });
    expect(failure.kind).toBe('rate_limited');
    expect(failure.message).toBe('Bitbucket is limiting requests, try again in 42 seconds');
  });

  it('keeps the host text for a refused merge and never guesses a reason', () => {
    const failure = bitbucketFailureOf({
      error: failing({
        kind: 'failed',
        status: 400,
        detail: errorBody('Merge strategy squash is not allowed', 'Use merge_commit'),
      }),
    });
    expect(failure.kind).toBe('failed');
    expect(failure.message).toBe('Merge strategy squash is not allowed: Use merge_commit');
    expect(failure.details).toBe('Merge strategy squash is not allowed: Use merge_commit');
  });

  it('keeps a body that is not json as the host text', () => {
    const failure = bitbucketFailureOf({
      error: failing({ kind: 'failed', status: 502, detail: 'Bad gateway' }),
    });
    expect(failure.kind).toBe('failed');
    expect(failure.message).toBe('Bad gateway');
  });

  it('names the status when the host sent no text at all', () => {
    expect(
      bitbucketFailureOf({ error: failing({ kind: 'failed', status: 500, detail: '' }) }).message,
    ).toBe('Bitbucket answered 500');
  });

  it('classifies a not found as a failure with the host text', () => {
    const failure = bitbucketFailureOf({
      error: failing({ kind: 'not_found', status: 404, detail: 'Repository not found' }),
    });
    expect(failure.kind).toBe('failed');
    expect(failure.message).toBe('Repository not found');
  });

  it('classifies an error without a failure kind as failed and does not read its prose', () => {
    const failure = bitbucketFailureOf({
      error: new CommandError({ kind: 'http', message: 'http error 403: nope' }),
    });
    expect(failure.kind).toBe('failed');
  });

  it('passes a typed port error through untouched', () => {
    const typed = new PullRequestPortError({ kind: 'failed', message: 'm', details: 'd' });
    expect(bitbucketFailureOf({ error: typed })).toBe(typed);
  });

  it('classifies a plain error as a failure carrying its message', () => {
    const failure = bitbucketFailureOf({ error: new Error('boom') });
    expect(failure.kind).toBe('failed');
    expect(failure.message).toBe('boom');
  });
});
