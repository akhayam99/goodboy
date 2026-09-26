// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';
import { PrSwitcher } from './PrSwitcher';

afterEach(cleanup);

const pr = ({ number, title }: { number: number; title: string }): PullRequestState => ({
  number,
  title,
  url: `https://github.com/northwind/ledger-core/pull/${number}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'nw/fix-posting-rounding',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-20T10:00:00.000Z',
});

const PRS = [
  pr({ number: 231, title: 'Fix the half-cent rounding drift' }),
  pr({ number: 232, title: 'Retry the posting queue' }),
];

describe('PrSwitcher', () => {
  it('shows the current pull request and switches to another', () => {
    const onSelect = vi.fn();
    render(<PrSwitcher prs={PRS} selected={231} onSelect={onSelect} />);

    const trigger = screen.getByRole('combobox', { name: '2 pull requests on this branch' });
    expect(trigger.textContent).toContain('#231');
    expect(trigger.textContent).toContain('of 2');

    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: /half-cent/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('option', { name: /posting queue/ }));

    expect(onSelect).toHaveBeenCalledWith(232);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
