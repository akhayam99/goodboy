// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { carriesWorkingTree } from './carriesWorkingTree';

describe('carriesWorkingTree', () => {
  it('starts a run with a note on the owner working tree, uncommitted changes included', () => {
    expect(carriesWorkingTree({ threadIds: ['note:harborline-header'] })).toBe(true);
    expect(carriesWorkingTree({ threadIds: ['PRRT_ledger-core', 'note:payments-api:g2'] })).toBe(
      true,
    );
  });

  it('keeps a run of host review comments on the branch head', () => {
    expect(carriesWorkingTree({ threadIds: ['PRRT_ledger-core'] })).toBe(false);
    expect(carriesWorkingTree({ threadIds: [] })).toBe(false);
  });
});
