// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkflowAutorunToggle } from './index';

afterEach(cleanup);

describe('WorkflowAutorunToggle', () => {
  it('reads as a switch named Autorun that carries its state', () => {
    render(<WorkflowAutorunToggle isOn={false} onToggle={vi.fn()} />);
    const toggle = screen.getByRole('switch', { name: 'Autorun' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles immediately when no step is in flight', () => {
    const onToggle = vi.fn();
    render(<WorkflowAutorunToggle isOn={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Autorun' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('turns autorun off immediately without presenting a stop confirmation', () => {
    const onToggle = vi.fn();
    render(<WorkflowAutorunToggle isOn onToggle={onToggle} />);
    expect(screen.getByRole('switch', { name: 'Autorun' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Autorun' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group')).toBeNull();
  });
});
