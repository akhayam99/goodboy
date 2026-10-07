// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { NeedsYouOwner } from '../../../../timeline/needsYou';
import { NeedsYouBlock } from './NeedsYouBlock';

afterEach(cleanup);

const owner = (overrides: Partial<NeedsYouOwner>): NeedsYouOwner => ({
  id: 'owner-1',
  kind: 'question',
  text: 'Retry policy · 1 question',
  at: null,
  item: null,
  question: null,
  questionIds: [],
  prNumber: null,
  owed: null,
  ...overrides,
});

const PR_OWNER = owner({
  id: 'owner-pr',
  kind: 'fixRun',
  text: '#318 · 1 question · 5 to review',
  prNumber: 318,
});
const REBASE_OWNER = owner({
  id: 'owner-rebase',
  kind: 'rebase',
  text: 'Rebase of hl/fix-duplicate-credit stopped ×2',
});

describe('NeedsYouBlock', () => {
  it('draws nothing while nothing needs you', () => {
    render(<NeedsYouBlock owners={[]} onOpen={vi.fn()} />);

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
  });

  it('gives each owner exactly one Open named after the row, and sends that owner', () => {
    const onOpen = vi.fn();
    render(<NeedsYouBlock owners={[PR_OWNER, REBASE_OWNER]} onOpen={onOpen} />);
    const card = screen.getByRole('region', { name: 'Needs you' });
    const buttons = within(card).getAllByRole('button');

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open: #318 · 1 question · 5 to review',
      'Open: Rebase of hl/fix-duplicate-credit stopped ×2',
    ]);
    expect(buttons.map((button) => button.textContent)).toEqual(['Open', 'Open']);
    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Open: Rebase of hl/fix-duplicate-credit stopped ×2',
      }),
    );

    expect(onOpen).toHaveBeenCalledWith({ owner: REBASE_OWNER });
  });

  it('carries its tone as one inner line', () => {
    render(<NeedsYouBlock owners={[PR_OWNER, REBASE_OWNER]} onOpen={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Needs you' });

    expect(within(card).getAllByTestId('tone-bar')).toHaveLength(1);
  });

  it('keeps the eyebrow plain: no glyph in it, and no glyph on the card but the row icons', () => {
    render(<NeedsYouBlock owners={[PR_OWNER, REBASE_OWNER]} onOpen={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Needs you' });
    const eyebrow = within(card).getByText('Needs you');

    expect(eyebrow.querySelector('svg')).toBeNull();
    expect(card.querySelectorAll('svg')).toHaveLength(2);
    expect(within(card).getAllByTestId('needs-you-owner')).toHaveLength(2);
  });
});
