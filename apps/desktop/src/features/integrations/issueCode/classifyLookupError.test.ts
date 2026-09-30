import { describe, expect, it } from 'vitest';
import { classifyLookupError } from './classifyLookupError';

describe('classifyLookupError', () => {
  it('reads a not_found kind as an issue that does not exist', () => {
    expect(classifyLookupError({ kind: 'not_found', message: 'no such issue' })).toBe('not-found');
  });

  it('never reads a missing gh CLI as an issue that does not exist', () => {
    expect(
      classifyLookupError({
        kind: 'gh_missing',
        message: 'Goodboy cannot find the gh CLI. Install it from cli.github.com.',
      }),
    ).toBe('unreachable');
  });

  it('reads an auth kind as unauthorized', () => {
    expect(classifyLookupError({ kind: 'auth', message: 'bad token' })).toBe('unauthorized');
  });
});
