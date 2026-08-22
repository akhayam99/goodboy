// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RailCard } from '../components/RailCard';
import { TERMINAL_DIM } from '../terminalDim';

afterEach(cleanup);

const cardOf = () => screen.getByRole('button', { name: 'Open the run' });

describe('RailCard', () => {
  it('keeps a live card at full strength on the elevated surface', () => {
    render(<RailCard title="Refactor" ariaLabel="Open the run" onSelect={vi.fn()} />);

    expect(cardOf().className).toContain('bg-elevated/40');
    expect(cardOf().className).not.toContain(TERMINAL_DIM);
  });

  it('dims a terminal card and drops its fill so it recedes from the live ones', () => {
    render(<RailCard title="Refactor" ariaLabel="Open the run" muted onSelect={vi.fn()} />);

    expect(cardOf().className).toContain(TERMINAL_DIM);
    expect(cardOf().className).toContain('bg-transparent');
    expect(cardOf().className).not.toContain('bg-elevated/40');
  });
});
