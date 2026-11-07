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

  it('draws no count on Changes, the file count lives in the page', () => {
    draw({ notPushed: 0 });

    expect(screen.getByRole('tab', { name: /^Changes/ }).textContent).toBe('Changes');
  });

  it('draws no count and no arrow on Commits, however many are not pushed', () => {
    draw({ notPushed: 3 });

    expect(screen.getByRole('tab', { name: /^Commits/ }).textContent).toBe('Commits');
  });

  it('draws a badge only on a page that wants you', () => {
    render(
      <BranchTabStrip
        tabs={[BRANCH_TAB_REGISTRY.pr, BRANCH_TAB_REGISTRY.files]}
        value="pr"
        onSelect={() => undefined}
        facts={worktreeEntryFactsOf({
          pullRequestState: 'merged',
          commentsNeedYou: 0,
          files: 64,
          diff: null,
          commits: 11,
          notPushed: 3,
          checks: null,
          checksUnreadReason: null,
        })}
      />,
    );

    expect(document.querySelectorAll('[data-tab-count]')).toHaveLength(0);
  });
});
