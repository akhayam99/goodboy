// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorStrip } from './ErrorStrip';

describe('ErrorStrip', () => {
  afterEach(cleanup);

  it('draws nothing without an error', () => {
    const { container } = render(
      <ErrorStrip labels={['pull requests']} error={null} onRetry={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('is one inline alert that names what failed and offers Retry', () => {
    const onRetry = vi.fn();
    render(
      <ErrorStrip
        labels={['pull requests', 'review throughput']}
        error={new Error('Rate limited')}
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-placement')).toBe('inline');
    expect(alert.textContent).toContain("Couldn't load pull requests and review throughput");
    expect(alert.textContent).toContain('Rate limited');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the raw text behind Details', () => {
    render(
      <ErrorStrip
        labels={['the diff']}
        error={new Error('git exited with status 128\nfatal: bad object')}
        onRetry={vi.fn()}
      />,
    );
    const details = screen.getByRole('button', { name: /Details/ });
    expect(screen.queryByText(/fatal: bad object/)).toBeNull();
    fireEvent.click(details);
    screen.getByText(/fatal: bad object/);
  });

  it('uses the warning tone for a permission problem', () => {
    render(
      <ErrorStrip
        labels={['ports']}
        error={new Error('Not allowed')}
        tone="warning"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').getAttribute('data-tone')).toBe('warning');
  });
});
