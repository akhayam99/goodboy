// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WorktreeStatus } from '@goodboy/types';
import { BranchPresenceLabel } from './BranchPresenceLabel';

const statusOf = (overrides: Partial<WorktreeStatus> = {}): WorktreeStatus => ({
  branch: 'feature/x',
  head: 'abc123',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/feature/x',
  inProgress: null,
  ...overrides,
});

afterEach(cleanup);

describe('BranchPresenceLabel', () => {
  it('renders nothing for a clean, fully pushed branch on origin', () => {
    const { container } = render(<BranchPresenceLabel status={statusOf()} />);

    expect(container.innerHTML).toBe('');
  });

  it('says merged, then N new commits when the branch moved past its merge', () => {
    render(<BranchPresenceLabel status={statusOf()} isMerged commitsAfterMerge={2} />);

    expect(screen.getByText('Merged, then 2 new commits')).toBeDefined();
  });

  it('names a branch never pushed as local only', () => {
    render(
      <BranchPresenceLabel
        status={statusOf({
          upstream: null,
          upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
        })}
      />,
    );

    expect(screen.getByText('Local only')).toBeDefined();
  });

  it('warns when the upstream branch is gone', () => {
    render(
      <BranchPresenceLabel
        status={statusOf({ upstreamDistance: { kind: 'unknown', reason: 'upstream-gone' } })}
      />,
    );

    expect(screen.getByText('Gone on origin')).toBeDefined();
  });

  it('names how many commits are still unpushed', () => {
    render(
      <BranchPresenceLabel
        status={statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } })}
      />,
    );

    expect(screen.getByText('2 to push')).toBeDefined();
  });

  it('renders nothing before status is known', () => {
    const { container } = render(<BranchPresenceLabel status={null} />);

    expect(container.innerHTML).toBe('');
  });

  it('names a merged branch', () => {
    render(<BranchPresenceLabel status={statusOf()} isMerged />);

    expect(screen.getByText('Merged')).toBeDefined();
  });
});
