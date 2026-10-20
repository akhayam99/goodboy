// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FactCardFacts } from './FactCardFacts';
import { FactCardFootnote } from './FactCardFootnote';
import { FactCardHeader } from './FactCardHeader';
import { FactCardState } from './FactCardState';

afterEach(cleanup);

describe('the fact card parts', () => {
  it('cuts a plain title and leaves a title node to the caller', () => {
    const { rerender } = render(<FactCardHeader title="Fix duplicate credits" />);

    expect(screen.getByText('Fix duplicate credits').className).toContain('truncate');

    rerender(<FactCardHeader title={<span data-testid="own">Harborline</span>} />);

    expect(screen.getByTestId('own').className).not.toContain('truncate');
  });

  it('puts the caller glyph before the words of a state', () => {
    render(
      <FactCardState
        glyph={<i data-testid="glyph" />}
        words={<b data-testid="words">Running</b>}
      />,
    );

    expect(screen.getByTestId('glyph').parentElement?.className).toContain('size-4');
    expect(screen.getByTestId('words').textContent).toBe('Running');
  });

  it('caps the label column so a long label cuts and the value stays visible', () => {
    render(
      <FactCardFacts
        facts={[{ label: 'Reconcile duplicate credits in the Harborline ledger', value: '3m' }]}
      />,
    );

    const label = screen.getByText('Reconcile duplicate credits in the Harborline ledger');
    expect(label.className).toContain('truncate');
    expect(label.closest('dl')?.className).toContain('grid-cols-[fit-content(40%)_minmax(0,1fr)]');
    expect(screen.getByText('3m').className).toContain('min-w-0');
  });

  it('draws a footnote in the faint tone', () => {
    render(<FactCardFootnote text="2 agents" />);

    expect(screen.getByText('2 agents').className).toContain('text-faint-foreground');
  });
});
