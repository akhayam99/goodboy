import { afterEach, beforeEach } from 'vitest';
import { drainUnexpectedCalls } from './unexpectedCalls';

beforeEach(() => {
  drainUnexpectedCalls();
});

afterEach(() => {
  const found = drainUnexpectedCalls();
  if (found.length === 0) {
    return;
  }
  throw new Error(
    `unstubbed calls in this test (stub each one with the value the real code returns, see docs/testing.md):\n${found.join('\n')}`,
  );
});
