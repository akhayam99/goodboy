// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { HostFailureKind } from '../../../shared/lib/hostFailure';
import { HOST_FAILURE_KINDS } from '../../../shared/lib/testing/hostFailureKinds';
import { CommandError } from '../../../shared/lib/invokeCommand';
import { gitlabFailureOf } from './classifyGitlabFailure';

const failing = ({
  kind,
  status,
  detail,
}: {
  readonly kind: HostFailureKind;
  readonly status: number | null;
  readonly detail: string | null;
}): CommandError =>
  new CommandError({
    kind: 'http',
    message: `http error ${status}: ${detail}`,
    failure: { kind, status, retryAfterSeconds: null, detail },
  });

describe('gitlabFailureOf', () => {
  it.each(HOST_FAILURE_KINDS)('keeps the kind %s that Rust decided', (kind) => {
    const failure = gitlabFailureOf({
      error: failing({ kind, status: 500, detail: 'host text' }),
    });
    expect(failure).toEqual({ kind, body: 'host text' });
  });

  it('reads the host text from the detail, not from the message prose', () => {
    const failure = gitlabFailureOf({
      error: failing({ kind: 'denied', status: 403, detail: '{"message":"403 Forbidden"}' }),
    });
    expect(failure.body).toBe('{"message":"403 Forbidden"}');
  });

  it('reads an error with no failure kind as failed and never guesses from the text', () => {
    expect(
      gitlabFailureOf({ error: new CommandError({ kind: 'http', message: 'http error 403: x' }) }),
    ).toEqual({ kind: 'failed', body: 'http error 403: x' });
    expect(
      gitlabFailureOf({
        error: new CommandError({ kind: 'shape', message: 'invalid response shape: x' }),
      }),
    ).toEqual({ kind: 'failed', body: 'invalid response shape: x' });
  });

  it('reads a plain error and a string by their text', () => {
    expect(gitlabFailureOf({ error: new Error('socket closed') })).toEqual({
      kind: 'failed',
      body: 'socket closed',
    });
    expect(gitlabFailureOf({ error: 'offline' })).toEqual({ kind: 'failed', body: 'offline' });
  });
});
