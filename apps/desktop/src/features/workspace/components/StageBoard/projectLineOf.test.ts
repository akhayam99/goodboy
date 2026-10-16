// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { projectLineOf } from './projectLineOf';

const mountOf = (mountName: string) => ({ mountName });

describe('the project line of a session', () => {
  it('names one project, counts the rest once, and says nothing without a project', () => {
    expect(projectLineOf({ mounts: [] })).toBe('');
    expect(projectLineOf({ mounts: [mountOf('payments-api')] })).toBe('payments-api');
    expect(
      projectLineOf({
        mounts: [mountOf('payments-api'), mountOf('payments-api'), mountOf('ledger-core')],
      }),
    ).toBe('payments-api +1');
  });
});
