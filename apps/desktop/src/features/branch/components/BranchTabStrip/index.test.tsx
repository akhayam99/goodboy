import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PrCheckRun } from '@goodboy/types';
import { branchTabFactsOf } from '../../branchTabFactsOf';
import { BRANCH_TAB_REGISTRY, branchTabsOf } from '../../branchTabs';
import { BranchTabStrip } from '.';

const TABS = branchTabsOf({ state: 'open', hasComments: true });

const check = (conclusion: PrCheckRun['conclusion']): PrCheckRun => ({
  name: `ledger-core ${conclusion}`,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

type DrawParams = {
  readonly commentsNeedYou?: number;
  readonly checks?: ReadonlyArray<PrCheckRun> | null;
  readonly notPushed?: number;
};

const factsOf = ({ commentsNeedYou = 0, checks = null, notPushed = 0 }: DrawParams) =>
  branchTabFactsOf({
    pullRequestState: 'open',
    commentsNeedYou,
    commentsOpen: 4,
    files: 64,
    diff: { additions: 1240, deletions: 318 },
    commits: 11,
    notPushed,
    checks,
    checksUnreadReason: null,
  });

const draw = (params: DrawParams) =>
  render(
    <BranchTabStrip tabs={TABS} value="pr" onSelect={() => undefined} facts={factsOf(params)} />,
  );

const countOf = (name: RegExp) =>
  screen.getByRole('tab', { name }).querySelector('[data-tab-count]');

describe('the facts on the branch tabs', () => {
  afterEach(cleanup);

  it('draws the file count and the lines added and removed on Changes', () => {
    draw({});

    const tab = screen.getByRole('tab', { name: /^Changes/ });
    expect(tab.textContent).toContain('64');
    expect(tab.textContent).toContain('+1240 -318');
  });

  it('draws the commit count on Commits', () => {
    draw({ notPushed: 3 });

    expect(screen.getByRole('tab', { name: /^Commits/ }).textContent).toContain('11');
  });

  it('draws the open comment count in faint ink when nothing needs you', () => {
    draw({});

    expect(countOf(/^Comments/)?.textContent).toBe('4');
    expect(countOf(/^Comments/)?.className).toContain('text-faint-foreground');
  });

  it('tints the comment count only when something needs you', () => {
    draw({ commentsNeedYou: 2 });

    expect(countOf(/^Comments/)?.className).not.toContain('text-faint-foreground');
  });

  it('draws the passed checks faint', () => {
    draw({ checks: [check('success'), check('success'), check('success')] });

    expect(countOf(/^Checks/)?.textContent).toBe('3');
    expect(countOf(/^Checks/)?.className).toContain('text-faint-foreground');
  });

  it('draws the failing checks in color', () => {
    draw({ checks: [check('success'), check('failure')] });

    expect(countOf(/^Checks/)?.textContent).toBe('1');
    expect(countOf(/^Checks/)?.className).not.toContain('text-faint-foreground');
  });

  it('draws the state word on a merged pull request', () => {
    render(
      <BranchTabStrip
        tabs={[BRANCH_TAB_REGISTRY.pr]}
        value="pr"
        onSelect={() => undefined}
        facts={branchTabFactsOf({
          pullRequestState: 'merged',
          commentsNeedYou: 0,
          commentsOpen: 0,
          files: null,
          diff: null,
          commits: null,
          notPushed: null,
          checks: null,
          checksUnreadReason: null,
        })}
      />,
    );

    expect(screen.getByRole('tab', { name: /^Overview/ }).textContent).toContain('Merged');
  });
});
