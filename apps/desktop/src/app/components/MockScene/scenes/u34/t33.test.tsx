// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { overviewCardsOf } from '../../../../../features/session/central/overviewCardsOf';
import { U34_T33_SCENES } from './t33';

afterEach(cleanup);

describe('the u34 skeleton scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(MOCK_SCENES['u34-t33-overview-loading']).toBe(
      U34_T33_SCENES['u34-t33-overview-loading'],
    );
    expect(MOCK_SCENES['u34-t34-column-loading']).toBe(U34_T33_SCENES['u34-t34-column-loading']);
  });

  it('draws the overview skeleton from the same card list as the real overview', () => {
    const Scene = U34_T33_SCENES['u34-t33-overview-loading'];
    const { container } = render(<Scene />);

    const expected = overviewCardsOf({
      cards: [],
      waitingCount: 0,
      runningCount: 1,
      stuckCount: 0,
      branchCount: 0,
      doneCount: 0,
      isArchived: false,
    });
    const drawn = [...container.querySelectorAll('[data-overview-card]')].map((card) =>
      card.getAttribute('data-overview-card'),
    );
    expect(drawn).toEqual(expected.map((card) => card.id));
    screen.getByRole('heading', { name: 'Needs you' });
  });

  it('draws only a title bar and one meta line above the cards, no pills or banners', () => {
    const Scene = U34_T33_SCENES['u34-t33-overview-loading'];
    const { container } = render(<Scene />);

    const stack = container.querySelector('[data-central-column-skeleton]')?.parentElement;
    expect(stack?.children).toHaveLength(2);
    expect(stack?.firstElementChild?.querySelectorAll('.bg-skeleton')).toHaveLength(2);
  });

  it('draws the column skeleton as one status with card-height blocks', () => {
    const Scene = U34_T33_SCENES['u34-t34-column-loading'];
    render(<Scene />);

    screen.getByRole('status', { name: 'Loading sessions' });
    const level = screen.getByRole('status', { name: 'Loading session' });
    expect(
      [...level.querySelectorAll('[data-level-card]')].map((card) =>
        card.getAttribute('data-level-card'),
      ),
    ).toEqual(['Projects', 'Linked']);
  });
});
