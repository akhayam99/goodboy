// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_TIMELINE_CARDS_SCENES } from './timeline-cards';

afterEach(cleanup);

describe('timeline cards scene', () => {
  it('registers the scene and its light twin for the capture', () => {
    expect(Object.keys(U27_TIMELINE_CARDS_SCENES)).toEqual([
      'timeline-cards',
      'timeline-cards-light',
    ]);
    expect(MOCK_SCENES['timeline-cards']).toBe(U27_TIMELINE_CARDS_SCENES['timeline-cards']);
    expect(MOCK_SCENES['timeline-cards-light']).toBe(
      U27_TIMELINE_CARDS_SCENES['timeline-cards-light'],
    );
  });

  it('opens the role, models and run cards at once on the floating surface', () => {
    const Scene = U27_TIMELINE_CARDS_SCENES['timeline-cards'];
    render(<Scene />);

    const cards = screen.getAllByTestId('fact-card');
    expect(cards).toHaveLength(5);
    expect(cards[0]?.textContent).toContain('Implementer');
    expect(cards[0]?.textContent).toContain('Sonnet 5.5');
    expect(cards[1]?.textContent).toContain('Kimi K3 High');
    expect(cards[2]?.textContent).toContain('Harden the webhook');
    expect(cards[2]?.textContent).toContain('GPT-6.1 Sol');
  });

  it('shows a role card on one provider and one on two providers', () => {
    const Scene = U27_TIMELINE_CARDS_SCENES['timeline-cards'];
    render(<Scene />);

    const cards = screen.getAllByTestId('fact-card');
    const one = cards[3];
    const two = cards[4];
    expect(one?.textContent).toContain('Working12m');
    expect(one?.querySelectorAll('[data-provider]')).toHaveLength(1);
    expect(two?.textContent).toContain('Needs you');
    expect(two?.textContent).toContain('asked 3m ago');
    expect(
      Array.from(two?.querySelectorAll('[data-provider]') ?? []).map((mark) =>
        mark.getAttribute('data-provider'),
      ),
    ).toEqual(['anthropic', 'codex']);
    expect(two?.querySelector('[aria-label="Effort Very high, 4 of 5"]')).not.toBeNull();
  });

  it('draws the light twin on the light theme', async () => {
    const Scene = U27_TIMELINE_CARDS_SCENES['timeline-cards-light'];
    render(<Scene />);

    expect(await screen.findByTestId('timeline-cards-stage')).toBeDefined();
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
