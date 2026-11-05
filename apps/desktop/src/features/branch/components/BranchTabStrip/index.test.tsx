import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BRANCH_TAB_REGISTRY } from '../../branchTabs';
import { worktreeEntryFactsOf } from '../../worktreeEntryFacts';
import { BranchTabStrip } from '.';

const TABS = [BRANCH_TAB_REGISTRY.pr, BRANCH_TAB_REGISTRY.files, BRANCH_TAB_REGISTRY.commits];

type DrawParams = {
  readonly notPushed: number;
};

const draw = ({ notPushed }: DrawParams) =>
  render(
    <BranchTabStrip
      tabs={TABS}
      value="pr"
      onSelect={() => undefined}
      facts={worktreeEntryFactsOf({
        pullRequestState: 'none',
        commentsNeedYou: 0,
        files: 64,
        diff: { additions: 1240, deletions: 318 },
        commits: 11,
        notPushed,
        checks: null,
        checksUnreadReason: null,
      })}
    />,
  );

describe('the facts on the branch tabs', () => {
  afterEach(cleanup);

  it('shows the file count and the lines added and removed on Files', () => {
    draw({ notPushed: 0 });

    expect(screen.getByRole('tab', { name: /^Files/ }).textContent).toBe('Files64+1240-318');
  });

  it('shows the commit count and how many are not pushed on Commits', () => {
    draw({ notPushed: 3 });

    expect(screen.getByRole('tab', { name: /^Commits/ }).textContent).toBe('Commits11↑3');
  });

  it('drops the arrow once everything is pushed', () => {
    draw({ notPushed: 0 });

    expect(screen.getByRole('tab', { name: /^Commits/ }).textContent).toBe('Commits11');
  });
});
