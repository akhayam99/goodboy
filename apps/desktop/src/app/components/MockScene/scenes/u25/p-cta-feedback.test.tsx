// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { U25_P_CTA_FEEDBACK_SCENES } from './p-cta-feedback';

afterEach(() => {
  cleanup();
});

describe('the cta feedback scenes', () => {
  it('shows the busy word on the Push button while it runs', () => {
    const Scene = U25_P_CTA_FEEDBACK_SCENES['cta-push-pending'];
    render(<Scene />);

    const button = screen.getByRole('button', { name: 'Pushing…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says what happened after the push with a dismiss button', () => {
    const Scene = U25_P_CTA_FEEDBACK_SCENES['cta-push-done'];
    render(<Scene />);

    expect(screen.getByRole('status').textContent).toContain('Pushed 1 commit to origin.');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });

  it('keeps the failure line with Retry', () => {
    const Scene = U25_P_CTA_FEEDBACK_SCENES['cta-push-failed'];
    render(<Scene />);

    expect(screen.getByRole('alert').textContent).toContain('pre-push hook declined');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});
