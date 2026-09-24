// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatusRailItem } from '../components/StatusRailItem';

afterEach(cleanup);

describe('StatusRailItem', () => {
  it('renders label, subtitle and a status dot in one selectable row', () => {
    const onClick = vi.fn();
    render(
      <StatusRailItem
        icon={<svg data-testid="glyph" />}
        label="Linear"
        subtitle="acme"
        tone="success"
        selected
        onClick={onClick}
      />,
    );

    const row = screen.getByRole('button', { name: /Linear/ });
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(screen.getByText('acme')).toBeDefined();
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('drops the subtitle line when there is none', () => {
    render(
      <StatusRailItem
        icon={null}
        label="Slack"
        tone="neutral"
        selected={false}
        onClick={vi.fn()}
      />,
    );

    const row = screen.getByRole('button', { name: 'Slack' });
    expect(row.getAttribute('aria-current')).toBe('false');
  });
});
