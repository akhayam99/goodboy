// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isPrePushFailure } from './isPrePushFailure';

describe('isPrePushFailure', () => {
  it.each([
    'pre-push hook declined: lint failed',
    'husky - pre-push script failed (code 1)',
    'PRE-PUSH: 2 tests failed',
  ])('reads %s as a local pre-push failure', (message) => {
    expect(isPrePushFailure({ message })).toBe(true);
  });

  it.each([
    ' ! [remote rejected] main -> main (pre-receive hook declined)',
    'remote: pre-receive hook declined',
    'Could not resolve host: github.com',
    '',
  ])('does not read %s as a local pre-push failure', (message) => {
    expect(isPrePushFailure({ message })).toBe(false);
  });
});
