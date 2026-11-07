// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { MergeBox as MergeBoxModel } from './mergeBox';
import { MergeBox } from './index';

afterEach(cleanup);

const BLOCKED: MergeBoxModel = {
  verdict: {
    kind: 'blocked',
    word: 'Not ready to merge',
    line: 'Fix the failing check, then answer omar-t.',
    tone: 'danger',
  },
  rows: [
    {
      id: 'checks',
      glyph: 'failing',
      title: '1 check failing',
      detail: 'payments-api / lint',
      tone: 'danger',
      opens: 'checks',
    },
    {
      id: 'review',
      glyph: 'ask',
      title: 'No review yet',
      detail: 'Nobody asked yet',
      tone: 'neutral',
      opens: null,
    },
  ],
  passing: ['7 checks passed', 'No conflicts'],
};

describe('MergeBox', () => {
  it('says the verdict first, then the rows in the order given, worst first', () => {
    render(<MergeBox box={BLOCKED} onOpen={() => undefined} />);

    const box = screen.getByRole('region', { name: 'Merge status' });
    expect(box.querySelector('[data-verdict]')?.textContent).toBe(
      'Not ready to mergeFix the failing check, then answer omar-t.',
    );
    const rows = within(screen.getByRole('list', { name: 'What holds the merge' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      '1 check failingpayments-api / lintChecks',
      'No review yetNobody asked yet',
    ]);
  });

  it('opens where a row leads and draws no button on a row that leads nowhere', () => {
    const onOpen = vi.fn();
    render(<MergeBox box={BLOCKED} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: /^1 check failing/ }));

    expect(onOpen).toHaveBeenCalledWith('checks');
    expect(screen.getByTestId('merge-row-review').tagName).toBe('DIV');
  });

  it('folds what passes into one quiet line that opens in place', () => {
    render(<MergeBox box={BLOCKED} onOpen={() => undefined} />);

    const line = screen.getByTestId('merge-passing');
    expect(line.textContent).toContain('7 checks passed · No conflicts');
    expect(line.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'What passes' })).toBeNull();

    fireEvent.click(line);

    expect(line.getAttribute('aria-expanded')).toBe('true');
    const passes = within(screen.getByRole('list', { name: 'What passes' })).getAllByRole(
      'listitem',
    );
    expect(passes.map((pass) => pass.textContent)).toEqual(['7 checks passed', 'No conflicts']);
  });

  it('draws shapes and one screen reader label while the pull request loads', () => {
    render(<MergeBox box={null} onOpen={() => undefined} />);

    const box = screen.getByRole('region', { name: 'Merge status' });
    expect(box.getAttribute('aria-busy')).toBe('true');
    expect(box.textContent).toBe('Reading merge status');
  });
});
