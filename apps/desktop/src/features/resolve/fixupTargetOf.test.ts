import { describe, expect, it } from 'vitest';
import { fixupTargetOf } from './fixupTargetOf';

const BRANCH = [
  { sha: '3a1f9c2aa', subject: 'Add retry policy' },
  { sha: '5b2e8d1bb', subject: 'Wire the webhook client' },
];

describe('fixupTargetOf', () => {
  it('names the branch commit a fixup subject points at', () => {
    const range = [{ sha: '9e8d7c6cc', subject: 'fixup! Add retry policy' }];

    expect(fixupTargetOf({ sha: '9e8d7c6', range, branch: BRANCH })).toBe('3a1f9c2aa');
  });

  it('reads a normal commit as no fixup', () => {
    const range = [{ sha: '4f21c8bdd', subject: 'Guard empty batches' }];

    expect(fixupTargetOf({ sha: '4f21c8b', range, branch: BRANCH })).toBeNull();
  });

  it('finds a target committed earlier in the same candidate', () => {
    const range = [
      { sha: '1111111ee', subject: 'Split the parser' },
      { sha: '2222222ff', subject: 'fixup! Split the parser' },
    ];

    expect(fixupTargetOf({ sha: '2222222', range, branch: BRANCH })).toBe('1111111ee');
  });

  it('gives up when the fixup names a subject that is not on the branch', () => {
    const range = [{ sha: '9e8d7c6cc', subject: 'fixup! Rename the queue' }];

    expect(fixupTargetOf({ sha: '9e8d7c6', range, branch: BRANCH })).toBeNull();
  });

  it('gives up when the recorded sha is not in the candidate', () => {
    const range = [{ sha: '9e8d7c6cc', subject: 'fixup! Add retry policy' }];

    expect(fixupTargetOf({ sha: 'abcdef0', range, branch: BRANCH })).toBeNull();
    expect(fixupTargetOf({ sha: '', range, branch: BRANCH })).toBeNull();
  });
});
