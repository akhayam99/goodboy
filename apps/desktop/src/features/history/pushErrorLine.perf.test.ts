// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pushErrorLine } from './pushErrorLine';

const BUDGET_MS = 500;

describe('pushErrorLine stays linear', () => {
  it('scans a huge message', () => {
    const message = `${'noise line\n'.repeat(9000)}permission denied`;
    const started = performance.now();
    pushErrorLine({ message });
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });
});
