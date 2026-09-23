// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RailCard } from '../components/RailCard';

afterEach(cleanup);

const cardOf = () => screen.getByRole('button', { name: 'Open the run' });

describe('RailCard', () => {
  it('reports selection from a live card', () => {
    const onSelect = vi.fn();
    render(<RailCard title="Refactor" ariaLabel="Open the run" onSelect={onSelect} />);
    cardOf().click();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('keeps a terminal card interactive', () => {
    const onSelect = vi.fn();
    render(<RailCard title="Refactor" ariaLabel="Open the run" muted onSelect={onSelect} />);
    cardOf().click();
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
