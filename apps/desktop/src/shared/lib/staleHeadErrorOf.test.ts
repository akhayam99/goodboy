// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { STALE_HEAD_MESSAGE } from '@goodboy/core';
import { CommandError } from './invokeCommand';
import { staleHeadErrorOf } from './staleHeadErrorOf';

describe('staleHeadErrorOf', () => {
  it('turns the host kind into a typed stale_head error that keeps the host text', () => {
    const error = staleHeadErrorOf({
      error: new CommandError({
        kind: 'stale_head',
        message: 'the branch changed after it was reviewed: reviewed 6c20f48a9e1d',
      }),
    });

    expect(error?.kind).toBe('stale_head');
    expect(error?.message).toBe(STALE_HEAD_MESSAGE);
    expect(error?.details).toContain('6c20f48a9e1d');
  });

  it.each([
    new CommandError({ kind: 'http', message: 'http error 409: conflict' }),
    new Error('stale_head'),
    'stale_head',
    null,
  ])('leaves %j to the caller', (error) => {
    expect(staleHeadErrorOf({ error })).toBeNull();
  });
});
