// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DelegationResult } from './DelegationResult';
import type { DelegationResultView } from './delegationResultOf';

const resultWith = ({ summary }: { readonly summary: string | null }): DelegationResultView => ({
  summary,
  changedFileCount: 0,
  checks: [],
  artifacts: [],
  questions: [],
  costUsd: null,
  isCostEstimated: false,
  reason: null,
  reasonText: null,
  remoteText: null,
  checksText: null,
  checksVerdict: null,
  canRerunChecks: false,
  publish: null,
});

afterEach(cleanup);

describe('DelegationResult summary', () => {
  it('renders markdown instead of literal asterisks', () => {
    const { container } = render(
      <DelegationResult
        result={resultWith({ summary: '- **Trailer grep:** none found\n- **Remote:** in sync' })}
      />,
    );

    expect(container.textContent).not.toContain('**');
    expect(container.querySelectorAll('li').length).toBe(2);
    expect(screen.getByText('Trailer grep:').tagName).toBe('STRONG');
  });

  it('keeps the prose and drops the artifact markup', () => {
    const summary =
      '**Done** for ledger-core\n<<artifact v=1 kind=report>>\n{"title":"Audit"}\n<</artifact>>';
    const { container } = render(<DelegationResult result={resultWith({ summary })} />);

    expect(screen.getByText('Done').tagName).toBe('STRONG');
    expect(container.textContent).not.toContain('<<artifact');
    expect(container.textContent).not.toContain('"title"');
  });

  it('shows the sentence when the branch changed online', () => {
    render(
      <DelegationResult
        result={{
          ...resultWith({ summary: null }),
          remoteText: 'The branch changed online while this agent worked.',
        }}
      />,
    );

    screen.getByText('The branch changed online while this agent worked.');
  });

  it('offers to run the checks again and disables the button while they run', () => {
    const onRerunChecks = vi.fn();
    const result: DelegationResultView = {
      ...resultWith({ summary: null }),
      checksText: 'Not checked: timed out',
      checksVerdict: 'not_checked',
      canRerunChecks: true,
    };
    const { rerender } = render(<DelegationResult result={result} onRerunChecks={onRerunChecks} />);

    screen.getByText('Not checked: timed out');
    fireEvent.click(screen.getByRole('button', { name: 'Run checks again' }));
    expect(onRerunChecks).toHaveBeenCalledTimes(1);

    rerender(<DelegationResult result={result} onRerunChecks={onRerunChecks} isRerunningChecks />);
    const running = screen.getByRole('button', { name: 'Running checks' });
    expect(running.hasAttribute('disabled')).toBe(true);
  });

  it('shows the verdict without a button when the checks cannot run again', () => {
    render(
      <DelegationResult
        result={{
          ...resultWith({ summary: null }),
          checksText: 'Checks green: typecheck',
          checksVerdict: 'green',
          canRerunChecks: false,
        }}
        onRerunChecks={vi.fn()}
      />,
    );

    screen.getByText('Checks green: typecheck');
    expect(screen.queryByRole('button', { name: 'Run checks again' })).toBeNull();
  });

  it('says what happened to the push and offers the one try again that can still pass', () => {
    const onRetryPublish = vi.fn();
    const result: DelegationResultView = {
      ...resultWith({ summary: null }),
      publish: {
        text: 'Not pushed: connection reset',
        state: 'failed',
        canRetry: true,
        canPutBack: false,
      },
    };
    const { rerender } = render(
      <DelegationResult result={result} onRetryPublish={onRetryPublish} />,
    );

    screen.getByText('Not pushed: connection reset');
    fireEvent.click(screen.getByRole('button', { name: 'Try the push again' }));
    expect(onRetryPublish).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Put back' })).toBeNull();

    rerender(<DelegationResult result={result} onRetryPublish={onRetryPublish} isActingPublish />);
    expect(
      screen.getByRole('button', { name: 'Try the push again' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('offers Put back after a force push and nothing after a push that cannot be undone', () => {
    const onPutBackPublish = vi.fn();
    const pushed: DelegationResultView = {
      ...resultWith({ summary: null }),
      publish: {
        text: 'Force pushed ak/ledger-export at abc1234, the earlier version is kept as a backup',
        state: 'pushed',
        canRetry: false,
        canPutBack: true,
      },
    };
    const { rerender } = render(
      <DelegationResult result={pushed} onPutBackPublish={onPutBackPublish} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Put back' }));
    expect(onPutBackPublish).toHaveBeenCalledTimes(1);

    rerender(
      <DelegationResult
        result={{
          ...pushed,
          publish: {
            text: 'Pushed ak/ledger-export at abc1234',
            state: 'pushed',
            canRetry: false,
            canPutBack: false,
          },
        }}
        onPutBackPublish={onPutBackPublish}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Put back' })).toBeNull();
  });

  it('shows no push line when nothing was asked to publish', () => {
    render(<DelegationResult result={resultWith({ summary: 'Done.' })} />);

    expect(screen.queryByText(/pushed/i)).toBeNull();
  });

  it('renders nothing for an empty summary', () => {
    const { container } = render(<DelegationResult result={resultWith({ summary: '   ' })} />);

    expect(container.textContent).toBe('');
  });
});
