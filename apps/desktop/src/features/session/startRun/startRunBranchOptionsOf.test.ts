import { describe, expect, it } from 'vitest';
import { startRunBranchOptionsOf } from './startRunBranchOptionsOf';

describe('startRunBranchOptionsOf', () => {
  it('offers nothing when the session has no branch and none was picked', () => {
    expect(startRunBranchOptionsOf({ branches: [], picked: null })).toBeNull();
  });

  it('shows the one branch of the session as the only choice', () => {
    const choice = startRunBranchOptionsOf({ branches: ['feat/replay'], picked: null });

    expect(choice?.options.map((option) => option.label)).toEqual(['feat/replay']);
    expect(choice?.label).toBe('feat/replay');
  });

  it('starts on any branch when the session has two, once each', () => {
    const choice = startRunBranchOptionsOf({
      branches: ['feat/replay', 'feat/retry-dedupe', 'feat/replay'],
      picked: null,
    });

    expect(choice?.options.map((option) => option.label)).toEqual([
      'Any branch',
      'feat/replay',
      'feat/retry-dedupe',
    ]);
    expect(choice?.value).toBe(choice?.anyValue);
    expect(choice?.label).toBe('Any branch');
  });

  it('keeps a branch a door picked even when the list has not read it yet', () => {
    const choice = startRunBranchOptionsOf({ branches: [], picked: 'feat/export-batch' });

    expect(choice?.value).toBe('feat/export-batch');
    expect(choice?.label).toBe('feat/export-batch');
  });
});
