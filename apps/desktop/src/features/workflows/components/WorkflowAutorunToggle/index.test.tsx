// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkflowAutorunToggle } from './index';

afterEach(cleanup);

describe('WorkflowAutorunToggle', () => {
  it('shows the computed on/off label in the detail variant instead of a static word', () => {
    render(
      <WorkflowAutorunToggle
        isOn={false}
        isStepInFlight={false}
        onToggle={vi.fn()}
        onStopNow={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Autorun off' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Autorun' })).toBeNull();
  });

  it('toggles immediately when no step is in flight', () => {
    const onToggle = vi.fn();
    render(
      <WorkflowAutorunToggle
        isOn={false}
        isStepInFlight={false}
        onToggle={onToggle}
        onStopNow={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Autorun off' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('arms a stop confirm instead of toggling while a step is in flight', () => {
    const onToggle = vi.fn();
    const onStopNow = vi.fn();
    render(<WorkflowAutorunToggle isOn isStepInFlight onToggle={onToggle} onStopNow={onStopNow} />);
    fireEvent.click(screen.getByRole('button', { name: 'Autorun on' }));
    expect(screen.getByText('Stop this run?')).toBeDefined();
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Stop the run' }));
    expect(onStopNow).toHaveBeenCalledOnce();
  });

  it('keeps the sidebar variant as an icon with the same computed label as its tooltip', () => {
    render(
      <WorkflowAutorunToggle
        variant="sidebar"
        isOn
        isStepInFlight={false}
        onToggle={vi.fn()}
        onStopNow={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Autorun on' })).toBeDefined();
  });
});
