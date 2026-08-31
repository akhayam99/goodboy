// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkflowAutorunToggle } from './index';

afterEach(cleanup);

describe('WorkflowAutorunToggle', () => {
  it('shows the computed on/off label in the detail variant instead of a static word', () => {
    render(<WorkflowAutorunToggle isOn={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Autorun off' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Autorun' })).toBeNull();
  });

  it('toggles immediately when no step is in flight', () => {
    const onToggle = vi.fn();
    render(<WorkflowAutorunToggle isOn={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Autorun off' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('turns autorun off immediately without presenting a stop confirmation', () => {
    const onToggle = vi.fn();
    render(<WorkflowAutorunToggle isOn onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Autorun on' }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('keeps the sidebar variant as an icon with the same computed label as its tooltip', () => {
    render(<WorkflowAutorunToggle variant="sidebar" isOn onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Autorun on' })).toBeDefined();
  });
});
