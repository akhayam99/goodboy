// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { NeedsYouOwner } from '../../../../timeline/needsYou';
import { NeedsYouBlock } from './NeedsYouBlock';

afterEach(cleanup);

const owner = (overrides: Partial<NeedsYouOwner>): NeedsYouOwner => ({
  id: 'owner-1',
  kind: 'question',
  text: 'Which retry cap?',
  where: 'Retry policy',
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
  text: '#318 · 5 to review · 1 question',
  where: null,
  prNumber: 318,
});
const REBASE_OWNER = owner({
  id: 'owner-rebase',
  kind: 'rebase',
  text: 'Rebase of hl/fix-duplicate-credit stopped',
  where: null,
});
const QUESTION_OWNER = owner({ id: 'owner-question' });

describe('NeedsYouBlock', () => {
  it('draws nothing while nothing needs you', () => {
    render(<NeedsYouBlock owners={[]} onOpen={vi.fn()} />);

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
  });

  it('draws each owner with the concept glyph of its Activity row', () => {
    const RUN_OWNER = owner({ id: 'owner-run', kind: 'run', text: 'Checkout run' });
    const AGENT_OWNER = owner({ id: 'owner-agent', kind: 'agent', text: 'Scout asks' });
    render(
      <NeedsYouBlock
        owners={[PR_OWNER, REBASE_OWNER, QUESTION_OWNER, RUN_OWNER, AGENT_OWNER]}
        onOpen={vi.fn()}
      />,
    );
    const glyphs = within(screen.getByRole('region', { name: 'Needs you' }))
      .getAllByRole('button')
      .map((button) => button.querySelector('svg')?.getAttribute('class') ?? '');

    expect(
      glyphs.map((name) =>
        name.split(' ').find((part) => part !== 'lucide' && part.startsWith('lucide-')),
      ),
    ).toEqual([
      'lucide-message-square-reply',
      'lucide-git-graph',
      'lucide-circle-question-mark',
      'lucide-waypoints',
      'lucide-bot',
    ]);
  });

  it('makes each row the button, with no Open word, and sends that owner', () => {
    const onOpen = vi.fn();
    render(<NeedsYouBlock owners={[PR_OWNER, REBASE_OWNER]} onOpen={onOpen} />);
    const card = screen.getByRole('region', { name: 'Needs you' });
    const buttons = within(card).getAllByRole('button');

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open: #318 · 5 to review · 1 question',
      'Open: Rebase of hl/fix-duplicate-credit stopped',
    ]);
    expect(buttons.map((button) => button.textContent)).toEqual([
      '#318 · 5 to review · 1 question',
      'Rebase of hl/fix-duplicate-credit stopped',
    ]);
    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Open: Rebase of hl/fix-duplicate-credit stopped',
      }),
    );

    expect(onOpen).toHaveBeenCalledWith({ owner: REBASE_OWNER });
  });

  it('says the question first and the run it belongs to after it in gray', () => {
    render(<NeedsYouBlock owners={[QUESTION_OWNER]} onOpen={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Needs you' });
    const row = within(card).getByRole('button', { name: 'Open: Which retry cap?, Retry policy' });

    expect(row.textContent).toBe('Which retry cap?Retry policy');
    expect(within(row).getByText('Retry policy')).toBeDefined();
  });

  it('draws no tone bar: the surface is quiet like every notice', () => {
    render(<NeedsYouBlock owners={[PR_OWNER, REBASE_OWNER]} onOpen={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Needs you' });

    expect(within(card).queryByTestId('tone-bar')).toBeNull();
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
