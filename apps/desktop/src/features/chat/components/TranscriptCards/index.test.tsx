// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProviderRunId } from '@goodboy/types';
import { TranscriptCard } from './index';

afterEach(cleanup);
const runId = 'run-1' as ProviderRunId;

describe('TranscriptCard', () => {
  it('renders nothing for a run completion', () => {
    const { container } = render(<TranscriptCard item={{ kind: 'done', key: 'done-1' }} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders no separator for a run completion', () => {
    const { container } = render(<TranscriptCard item={{ kind: 'done', key: 'done-1' }} />);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
  });

  it('renders retry in the transcript for retryable errors', async () => {
    const user = userEvent.setup();
    const onRetryError = vi.fn();
    render(
      <TranscriptCard
        item={{
          kind: 'error',
          key: 'error-1',
          message: 'provider crashed mid-stream',
          runId,
          retryable: true,
        }}
        onRetryError={onRetryError}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(onRetryError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', key: 'error-1', runId, retryable: true }),
    );
  });

  it('does not render retry for non-retryable transcript errors', () => {
    render(
      <TranscriptCard
        item={{
          kind: 'error',
          key: 'error-1',
          message:
            'provider exited without a response. check that the CLI is configured correctly.',
          runId,
          retryable: false,
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull();
  });

  it('discloses long transcript errors in place', async () => {
    const user = userEvent.setup();
    const longMessage =
      'provider stderr: ' +
      'x'.repeat(320) +
      ' this tail should only be visible after expanding the full error body';
    render(
      <TranscriptCard
        item={{
          kind: 'error',
          key: 'error-long',
          message: longMessage,
          runId,
          retryable: false,
        }}
      />,
    );
    const disclosure = screen.getByRole('button', { name: 'Show more' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    await user.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(longMessage)).toBeTruthy();
  });
});
