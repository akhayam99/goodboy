import { describe, expect, it } from 'vitest';
import { remapCommitShas } from './commitMapping';

const BEFORE = [{ sha: '4f21c8bfull' }, { sha: '5a5a5a5full' }];
const AFTER = [{ sha: '9e8d7c6full' }, { sha: '7c1e0aafull' }];

describe('remapCommitShas', () => {
  it('moves each recorded sha to the commit the cherry-pick made from it', () => {
    expect(remapCommitShas({ shas: ['5a5a5a5'], before: BEFORE, after: AFTER })).toEqual([
      '7c1e0aafull',
    ]);
  });

  it('keeps a sha the candidate does not hold', () => {
    expect(remapCommitShas({ shas: ['1234567'], before: BEFORE, after: AFTER })).toEqual([
      '1234567',
    ]);
  });

  it('changes nothing when the replay does not line up', () => {
    expect(
      remapCommitShas({ shas: ['4f21c8b'], before: BEFORE, after: AFTER.slice(0, 1) }),
    ).toEqual(['4f21c8b']);
  });
});
