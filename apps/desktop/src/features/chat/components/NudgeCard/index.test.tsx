// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NudgeCard } from './index';

afterEach(cleanup);

describe('NudgeCard', () => {
  it('renders the title and a labelled region', () => {
    render(<NudgeCard severity="info" title="a nudge" ariaLabel="info nudge" />);
    expect(screen.getByLabelText('info nudge')).toBeDefined();
    expect(screen.getByText('a nudge')).toBeDefined();
  });

  it('fires primary action on click', () => {
    const onClick = vi.fn();
    render(
      <NudgeCard
        severity="warning"
        title="warn"
        ariaLabel="w"
        primary={{ label: 'go', onClick }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /go/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('paints the demands-you fill and a solid primary action', () => {
    const { container } = render(
      <NudgeCard
        severity="warning"
        title="warn"
        ariaLabel="w"
        primary={{ label: 'go', onClick: vi.fn() }}
      />,
    );
    expect(container.firstElementChild?.className).toContain('bg-warning/10');
    expect(container.firstElementChild?.className).toContain('border-warning/40');
    expect(screen.getByRole('button', { name: /go/i }).className).toContain(
      'bg-warning text-warning-foreground',
    );
  });

  it('fires onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<NudgeCard severity="success" title="ok" ariaLabel="o" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
