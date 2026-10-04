// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary, type ErrorReportRequest } from '../components/ErrorBoundary';

afterEach(cleanup);

function Boom({ throwNow }: { throwNow: boolean }): null {
  if (throwNow) {
    throw new Error('kaboom with ghp_secret');
  }
  return null;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>safe content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeDefined();
  });

  it('renders the recovery alert when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/something went wrong/i)).toBeDefined();
    expect(screen.getByText(/kaboom/)).toBeDefined();
    consoleError.mockRestore();
  });

  it('exposes a reload button that calls window.location.reload', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload },
    });
    render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(reload).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('offers the cheap recovery before the destructive one, in sentence case', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeDefined();
    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels).toEqual(['Retry', 'Reload']);
    consoleError.mockRestore();
  });

  it('shows the message through the injected filter', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary describeError={(error) => error.message.replace('ghp_secret', '[redacted]')}>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('kaboom with [redacted]')).toBeDefined();
    expect(screen.queryByText(/ghp_secret/)).toBeNull();
    consoleError.mockRestore();
  });

  it('renders the injected report inline with the caught error and the component stack', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const renderReport = vi.fn((request: ErrorReportRequest) => (
      <p>report for {request.error.message}</p>
    ));
    render(
      <ErrorBoundary renderReport={renderReport}>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('report for kaboom with ghp_secret')).toBeDefined();
    const last = renderReport.mock.calls.at(-1)?.[0];
    expect(last?.componentStack).not.toBeNull();
    consoleError.mockRestore();
  });

  it('has no report when no report path was injected', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    expect(screen.queryByRole('button', { name: /report/i })).toBeNull();
    consoleError.mockRestore();
  });
});
