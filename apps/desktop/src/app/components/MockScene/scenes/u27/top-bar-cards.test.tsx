// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_TOP_BAR_CARDS_SCENES } from './top-bar-cards';

afterEach(cleanup);

describe('top bar cards scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U27_TOP_BAR_CARDS_SCENES)).toEqual(['top-bar-cards']);
    expect(MOCK_SCENES['top-bar-cards']).toBe(U27_TOP_BAR_CARDS_SCENES['top-bar-cards']);
  });

  it('opens the limits, usage and repository cards at once', () => {
    const Scene = U27_TOP_BAR_CARDS_SCENES['top-bar-cards'];
    render(<Scene />);

    const cards = screen.getAllByTestId('fact-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]?.textContent).toContain('Codex');
    expect(cards[0]?.textContent).toContain('Weekly');
    expect(cards[1]?.textContent).toContain('Spent');
    expect(cards[2]?.textContent).toContain('payments-api');
    expect(cards[2]?.textContent).toContain('3 behind');
  });
});
