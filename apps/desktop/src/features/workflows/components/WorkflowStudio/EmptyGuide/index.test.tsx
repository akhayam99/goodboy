// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EmptyGuide } from './index';

afterEach(cleanup);

describe('EmptyGuide', () => {
  it('frames the first run when no presets exist yet', () => {
    render(<EmptyGuide onNew={() => undefined} hasPresets={false} />);
    expect(screen.getByText(/design your first workflow/i)).toBeDefined();
    expect(screen.getByText(/run it on any session/i)).toBeDefined();
  });

  it('points returning users to the preset list', () => {
    render(<EmptyGuide onNew={() => undefined} hasPresets />);
    expect(screen.getByText(/build a workflow/i)).toBeDefined();
    expect(screen.getByText(/pick a preset on the left/i)).toBeDefined();
  });

  it('points to the step library as the source of steps', () => {
    render(<EmptyGuide onNew={() => undefined} hasPresets={false} />);
    expect(screen.getByText(/step library on the right/i)).toBeDefined();
  });

  it('starts a new workflow from the call to action', () => {
    const onNew = vi.fn();
    render(<EmptyGuide onNew={onNew} hasPresets={false} />);
    fireEvent.click(screen.getByRole('button', { name: /new workflow/i }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
