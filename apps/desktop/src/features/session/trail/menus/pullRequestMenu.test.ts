// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { PullRequestState } from '@goodboy/types';
import { pullRequestMenu } from './pullRequestMenu';

const pr = (patch: Partial<PullRequestState>): PullRequestState =>
  ({
    number: 528,
    title: 'Round postings half even',
    url: 'https://github.com/acme/ledger-core/pull/528',
    state: 'open',
    isDraft: false,
    headBranch: 'fix/rounding-postings',
    baseBranch: 'main',
    ...patch,
  }) as PullRequestState;

describe('pullRequestMenu', () => {
  it('lists the session pull requests by branch, the shown one current', () => {
    const onSelect = vi.fn();
    const menu = pullRequestMenu({
      prs: [pr({}), pr({ number: 531, title: 'Cache fx rates', headBranch: 'feat/fx-cache' })],
      currentNumber: 528,
      actions: [],
      onSelect,
    });

    expect(menu.groups.map((group) => group.label)).toEqual([
      'fix/rounding-postings',
      'feat/fx-cache',
    ]);
    const rows = menu.groups.flatMap((group) => group.rows);
    expect(rows.map((row) => [row.label, row.isCurrent])).toEqual([
      ['#528 Round postings half even', true],
      ['#531 Cache fx rates', false],
    ]);
    rows[1]?.onSelect();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ number: 531 }));
  });

  it('says a draft is a draft', () => {
    const menu = pullRequestMenu({
      prs: [pr({ isDraft: true })],
      currentNumber: 528,
      actions: [],
      onSelect: vi.fn(),
    });

    expect(menu.groups[0]?.rows[0]?.state?.word).toBe('Draft');
  });

  it('says closed and merged for a pull request GitHub still flags as a draft', () => {
    const menu = pullRequestMenu({
      prs: [
        pr({ number: 9913, state: 'closed', isDraft: true }),
        pr({ number: 9914, state: 'merged', isDraft: true }),
      ],
      currentNumber: null,
      actions: [],
      onSelect: vi.fn(),
    });

    const rows = menu.groups.flatMap((group) => group.rows);
    expect(rows.map((row) => row.state?.word)).toEqual(['Closed', 'Merged']);
  });
});
