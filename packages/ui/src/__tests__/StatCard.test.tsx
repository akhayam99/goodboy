// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StatCard } from '../components/StatCard';

afterEach(cleanup);

describe('StatCard layout', () => {
  it('clamps the label block to two lines', () => {
    const { container } = render(<StatCard label="Pull requests merged" value="14" />);

    const label = container.querySelector('[data-stat-label]');
    expect(label?.firstElementChild?.className).toContain('line-clamp-2');
  });

  it('pins the figure to the card bottom with mt-auto', () => {
    render(<StatCard label="Sessions" value="38" />);

    const figure = screen.getByText('38');
    expect(figure.className).toContain('mt-auto');
    expect(figure.className).toContain('tabular-nums');
    expect(figure.className).not.toContain('font-mono');
  });

  it('puts the delta on its own row below the figure, never beside the label', () => {
    const { container } = render(
      <StatCard label="Median session" value="2.4h" status={<span>down 10 pts</span>} />,
    );

    const label = container.querySelector('[data-stat-label]');
    const delta = container.querySelector('[data-stat-delta]');
    expect(label?.textContent).not.toContain('down 10 pts');
    expect(delta?.textContent).toBe('down 10 pts');
    expect(
      screen.getByText('2.4h').compareDocumentPosition(delta as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps hint and delta in the same row so the card has one extra row at most', () => {
    const { container } = render(
      <StatCard label="Sessions" value="38" hint="3 deleted" status={<span>up 2</span>} />,
    );

    expect(container.querySelectorAll('[data-stat-delta]')).toHaveLength(1);
    expect(container.querySelector('[data-stat-delta]')?.textContent).toContain('3 deleted');
  });

  it('reserves the delta row on request so figures line up across cards', () => {
    const { container } = render(<StatCard label="Sessions" value="38" reservesDeltaRow />);

    const delta = container.querySelector('[data-stat-delta]');
    expect(delta).not.toBeNull();
    expect(delta?.className).toContain('min-h-4');
  });

  it('draws no delta row when there is nothing to say and no reserve', () => {
    const { container } = render(<StatCard label="Sessions" value="38" />);

    expect(container.querySelector('[data-stat-delta]')).toBeNull();
  });
});
