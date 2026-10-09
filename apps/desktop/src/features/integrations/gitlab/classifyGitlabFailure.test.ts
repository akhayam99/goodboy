// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CommandError } from '../../../shared/lib/invokeCommand';
import { classifyGitlabFailure, gitlabFailureOf } from './classifyGitlabFailure';

describe('classifyGitlabFailure', () => {
  it.each([
    [401, 'bad_credentials'],
    [403, 'denied'],
    [429, 'rate_limited'],
    [0, 'network'],
    [404, 'failed'],
    [422, 'failed'],
    [500, 'failed'],
    [502, 'failed'],
  ] as const)('reads status %s as %s', (status, kind) => {
    expect(classifyGitlabFailure({ status, body: '' })).toBe(kind);
  });

  it('reads an unknown status as failed and never guesses from the text', () => {
    expect(classifyGitlabFailure({ status: null, body: '403 Forbidden' })).toBe('failed');
    expect(classifyGitlabFailure({ status: 500, body: 'rate limit exceeded' })).toBe('failed');
    expect(classifyGitlabFailure({ status: null, body: 'something odd' })).toBe('failed');
  });
});

describe('gitlabFailureOf', () => {
  it.each([
    ['http', 'http error 403: {"message":"403 Forbidden"}', 403, '{"message":"403 Forbidden"}'],
    ['http', 'http error 401: 401 Unauthorized', 401, '401 Unauthorized'],
    ['http', 'http error 0: error sending request', 0, 'error sending request'],
    ['http', 'http error 500: ', 500, ''],
    ['timeout', 'request timed out: deadline', 0, 'request timed out: deadline'],
    [
      'no_token',
      'no personal API key stored for workspace ws-1',
      401,
      'no personal API key stored for workspace ws-1',
    ],
    ['shape', 'invalid response shape: x', null, 'invalid response shape: x'],
    ['http', 'something without a status', null, 'something without a status'],
  ] as const)('reads a %s error %j as status %s', (kind, message, status, body) => {
    expect(gitlabFailureOf({ error: new CommandError({ kind, message }) })).toEqual({
      status,
      body,
    });
  });

  it('reads a plain error and a string by their text, with no status', () => {
    expect(gitlabFailureOf({ error: new Error('socket closed') })).toEqual({
      status: null,
      body: 'socket closed',
    });
    expect(gitlabFailureOf({ error: 'offline' })).toEqual({ status: null, body: 'offline' });
  });
});
