// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_TIMELINE_CARDS_SCENES } from './timeline-cards';

afterEach(cleanup);

describe('timeline cards scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U27_TIMELINE_CARDS_SCENES)).toEqual(['timeline-cards']);
    expect(MOCK_SCENES['timeline-cards']).toBe(U27_TIMELINE_CARDS_SCENES['timeline-cards']);
  });

  it('opens the role, models and run cards at once on the floating surface', () => {
    const Scene = U27_TIMELINE_CARDS_SCENES['timeline-cards'];
    render(<Scene />);

    const cards = screen.getAllByTestId('fact-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]?.textContent).toContain('Implementer');
    expect(cards[0]?.textContent).toContain('Sonnet 5.5');
    expect(cards[1]?.textContent).toContain('Kimi K3 High');
    expect(cards[2]?.textContent).toContain('Harden the webhook');
    expect(cards[2]?.textContent).toContain('GPT-6.1 Sol');
  });
});
