// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_FACT_CARD_SCENES } from './fact-card';

afterEach(cleanup);

describe('fact card scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U27_FACT_CARD_SCENES)).toEqual(['fact-card']);
    expect(MOCK_SCENES['fact-card']).toBe(U27_FACT_CARD_SCENES['fact-card']);
  });

  it('opens every card at once with header, state, facts and footnote', () => {
    const Scene = U27_FACT_CARD_SCENES['fact-card'];
    render(<Scene />);

    const cards = screen.getAllByTestId('fact-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]?.textContent).toContain('Northwind limits');
    expect(cards[0]?.textContent).toContain('Near the 5 hour limit');
    expect(cards[0]?.textContent).toContain('82% used');
    expect(cards[0]?.textContent).toContain('Updated 14:02');
  });

  it('keeps the value of a fact with a long label in view', () => {
    const Scene = U27_FACT_CARD_SCENES['fact-card'];
    render(<Scene />);

    const label = screen.getByText('Reconcile duplicate credits in the Harborline ledger export');
    expect(label.tagName).toBe('DT');
    expect(label.nextElementSibling?.textContent).toBe('Running');
  });

  it('describes each trigger with the sentence of its card', () => {
    const Scene = U27_FACT_CARD_SCENES['fact-card'];
    render(<Scene />);

    const trigger = screen.getByRole('button', { name: 'test failed' });
    const sentence = document.getElementById(trigger.getAttribute('aria-describedby') ?? '');
    expect(sentence?.textContent).toBe(
      'payments-api test. Failed. Took, 1m 32s. Workflow, ci.yml. Branch, ledger-core/retry. Click to open the run.',
    );
  });
});
