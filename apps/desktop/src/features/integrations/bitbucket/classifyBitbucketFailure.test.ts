// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PullRequestPortError } from '@goodboy/core';
import { CommandError } from '../../../shared/lib/invokeCommand';
import { bitbucketFailureOf } from './classifyBitbucketFailure';

const http = (status: number, body: string): CommandError =>
  new CommandError({ kind: 'http', message: `http error ${status}: ${body}` });

const errorBody = (message: string, detail?: string): string =>
  JSON.stringify({
    type: 'error',
    error: { message, ...(detail === undefined ? {} : { detail }) },
  });

describe('bitbucketFailureOf', () => {
  it.each([
    [
      '401 bad credentials',
      new CommandError({ kind: 'auth', message: 'authentication failed: x' }),
      'denied',
      'Check the email and API token',
    ],
    [
      '403 denied',
      new CommandError({ kind: 'forbidden', message: 'forbidden: x' }),
      'denied',
      'The API token lacks the pull request scope',
    ],
    [
      '429 rate limited',
      http(429, errorBody('Too many requests')),
      'rate_limited',
      'Bitbucket is limiting requests, try again in a minute',
    ],
    [
      'status 0 network',
      http(0, 'connection refused'),
      'network',
      'Bitbucket did not answer, check the connection',
    ],
    [
      'timeout',
      new CommandError({ kind: 'timeout', message: 'request timed out: 30s' }),
      'network',
      'Bitbucket did not answer, check the connection',
    ],
    [
      'no credential',
      new CommandError({ kind: 'no_token', message: 'no personal API key stored' }),
      'denied',
      'Check the email and API token',
    ],
  ] as const)('%s', (_label, error, kind, message) => {
    const failure = bitbucketFailureOf({ error });
    expect(failure).toBeInstanceOf(PullRequestPortError);
    expect(failure.kind).toBe(kind);
    expect(failure.message).toBe(message);
  });

  it('classifies an http 401 and 403 the same as the auth kinds', () => {
    expect(bitbucketFailureOf({ error: http(401, '{}') }).message).toBe(
      'Check the email and API token',
    );
    expect(bitbucketFailureOf({ error: http(403, '{}') }).message).toBe(
      'The API token lacks the pull request scope',
    );
  });

  it('keeps the host text for a refused merge and never guesses a reason', () => {
    const failure = bitbucketFailureOf({
      error: http(400, errorBody('Merge strategy squash is not allowed', 'Use merge_commit')),
    });
    expect(failure.kind).toBe('failed');
    expect(failure.message).toBe('Merge strategy squash is not allowed: Use merge_commit');
    expect(failure.details).toBe('Merge strategy squash is not allowed: Use merge_commit');
  });

  it('keeps a body that is not json as the host text', () => {
    const failure = bitbucketFailureOf({ error: http(502, 'Bad gateway') });
    expect(failure.kind).toBe('failed');
    expect(failure.message).toBe('Bad gateway');
  });

  it('names the status when the host sent no text at all', () => {
    expect(bitbucketFailureOf({ error: http(500, '') }).message).toBe('Bitbucket answered 500');
  });

  it('classifies a not found as a failure with the host text', () => {
    const failure = bitbucketFailureOf({
      error: new CommandError({ kind: 'not_found', message: 'not found: Repository not found' }),
    });
    expect(failure.kind).toBe('failed');
    expect(failure.message).toContain('Repository not found');
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
