// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { U38_ACTION_RUN_LINE_SCENES } from './action-run-line';

afterEach(() => {
  cleanup();
});

describe('the action run line scenes', () => {
  it('keeps the busy mark on the control and counts the seconds of a slow run', () => {
    const Scene = U38_ACTION_RUN_LINE_SCENES['u38-action-run-slow'];
    render(<Scene />);

    const button = screen.getByRole('button', { name: 'Merging… 7s' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the done line in place with Dismiss', () => {
    const Scene = U38_ACTION_RUN_LINE_SCENES['u38-action-run-done-light'];
    render(<Scene />);

    expect(screen.getByRole('status').textContent).toContain('Merged #318 into main.');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });

  it('shows the failure once, in place, with Retry', () => {
    const Scene = U38_ACTION_RUN_LINE_SCENES['u38-action-run-failed'];
    render(<Scene />);

    expect(screen.getByRole('alert').textContent).toContain('Base branch was modified');
    expect(screen.getAllByText(/Base branch was modified/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('registers every state in both themes', () => {
    expect(Object.keys(U38_ACTION_RUN_LINE_SCENES)).toEqual([
      'u38-action-run-slow',
      'u38-action-run-slow-light',
      'u38-action-run-done',
      'u38-action-run-done-light',
      'u38-action-run-failed',
      'u38-action-run-failed-light',
    ]);
  });
});
