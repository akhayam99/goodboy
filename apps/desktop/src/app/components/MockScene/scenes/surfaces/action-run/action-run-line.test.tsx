// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ACTION_RUN_LINE_SCENES } from './action-run-line';

afterEach(() => {
  cleanup();
});

describe('the action run line scenes', () => {
  it('shows the plain control and no line when idle', () => {
    const Scene = ACTION_RUN_LINE_SCENES['action-run-idle'];
    render(<Scene />);

    const button = screen.getByRole('button', { name: 'Merge' });
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the busy mark on the control and counts the seconds of a slow run', () => {
    const Scene = ACTION_RUN_LINE_SCENES['action-run-busy'];
    render(<Scene />);

    const button = screen.getByRole('button', { name: 'Merging… 7s' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the done line in place with Dismiss', () => {
    const Scene = ACTION_RUN_LINE_SCENES['action-run-done-light'];
    render(<Scene />);

    expect(screen.getByRole('status').textContent).toContain('Merged #318 into main.');
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
  });

  it('shows the failure once, in place, with Retry', () => {
    const Scene = ACTION_RUN_LINE_SCENES['action-run-failed'];
    render(<Scene />);

    expect(screen.getByRole('alert').textContent).toContain('Base branch was modified');
    expect(screen.getAllByText(/Base branch was modified/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
  });

  it('registers every state in both themes', () => {
    expect(Object.keys(ACTION_RUN_LINE_SCENES)).toEqual([
      'action-run-idle',
      'action-run-idle-light',
      'action-run-busy',
      'action-run-busy-light',
      'action-run-done',
      'action-run-done-light',
      'action-run-failed',
      'action-run-failed-light',
    ]);
  });
});
