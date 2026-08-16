// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
import {
  ErrorBoundary,
  type ErrorReportOutcome,
  type ErrorReportRequest,
} from '../components/ErrorBoundary';

const SUMMARY = 'The report carries the message above and the component stack.';

const opened = async (): Promise<ErrorReportOutcome> => ({ kind: 'opened' });

afterEach(cleanup);

function Boom({ throwNow }: { throwNow: boolean }): null {
  if (throwNow) {
    throw new Error('kaboom');
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
      <ErrorBoundary onReport={opened} reportSummary={SUMMARY}>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeDefined();
    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels[0]).toBe('Try again');
    expect(labels[1]).toBe('Reload');
    consoleError.mockRestore();
  });

  it('wraps the trace instead of hiding it behind a horizontal scrollbar', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    const trace = container.querySelector('pre');
    expect(trace?.className).toContain('whitespace-pre-wrap');
    expect(trace?.className).toContain('break-words');
    consoleError.mockRestore();
  });

  it('names GitHub in the report control and says what it includes before the click', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary onReport={opened} reportSummary={SUMMARY}>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Report this on GitHub' })).toBeDefined();
    expect(screen.getByText(SUMMARY)).toBeDefined();
    consoleError.mockRestore();
  });

  it('has no report control when no report path was injected', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    expect(screen.queryByRole('button', { name: /report/i })).toBeNull();
    consoleError.mockRestore();
  });

  it('hands the caught error and the component stack to the report path', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onReport = vi.fn<(request: ErrorReportRequest) => Promise<ErrorReportOutcome>>(
      async () => ({ kind: 'opened' }),
    );
    render(
      <ErrorBoundary onReport={onReport} reportSummary={SUMMARY}>
        <Boom throwNow />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Report this on GitHub' }));

    await waitFor(() => expect(onReport).toHaveBeenCalledTimes(1));
    expect(onReport.mock.calls[0]?.[0].error.message).toBe('kaboom');
    expect(onReport.mock.calls[0]?.[0].componentStack).not.toBe('');
    consoleError.mockRestore();
  });

  it('renders its own failure in place when the browser will not open', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary
        onReport={async () => ({ kind: 'failed', url: 'https://github.com/owner/repo/issues/new' })}
        reportSummary={SUMMARY}
      >
        <Boom throwNow />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Report this on GitHub' }));

    expect(await screen.findByText(/could not open your browser/i)).toBeDefined();
    expect(screen.getByText('https://github.com/owner/repo/issues/new')).toBeDefined();
    consoleError.mockRestore();
  });

  it('renders its own failure in place when the report link cannot be built', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary
        onReport={async () => {
          throw new Error('no url');
        }}
        reportSummary={SUMMARY}
      >
        <Boom throwNow />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Report this on GitHub' }));

    expect(await screen.findByText(/could not build the report link/i)).toBeDefined();
    consoleError.mockRestore();
  });
});
