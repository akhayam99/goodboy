// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DelegationResult } from './DelegationResult';
import { delegationResultOf, type DelegationResultView } from './delegationResultOf';

const resultWith = ({ summary }: { readonly summary: string | null }): DelegationResultView => ({
  outcomeLine: null,
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
    fireEvent.click(screen.getByRole('button', { name: 'Notes, 2 lines' }));

    expect(container.textContent).not.toContain('**');
    expect(container.querySelectorAll('li').length).toBe(2);
    expect(screen.getByText('Trailer grep:').tagName).toBe('STRONG');
  });

  it('keeps the prose and drops the artifact markup', () => {
    const summary =
      '**Done** for ledger-core\n<<artifact v=1 kind=report>>\n{"title":"Audit"}\n<</artifact>>';
    const { container } = render(<DelegationResult result={resultWith({ summary })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Notes, 1 line' }));

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

const rawResult = ({
  summary,
  verdict,
}: {
  readonly summary: string;
  readonly verdict: 'green' | 'red';
}): unknown => ({
  outcome: 'completed',
  declared: { summary },
  verified: {
    changedFiles: [{ path: 'src/ledger/postCredit.ts' }],
    checks: [
      { name: 'typecheck', status: 'pass', source: 'harness' },
      { name: 'unit tests', status: verdict === 'red' ? 'fail' : 'pass', source: 'harness' },
    ],
    checksRun: { verdict, reason: null, commit: null },
  },
  artifacts: [],
  openQuestions: [],
  cost: { usd: null, basis: 'estimate' },
  reason: null,
});

describe('DelegationResult reading order', () => {
  it('leads with the outcome line and keeps the model sentence when the facts agree', () => {
    const view = delegationResultOf({
      result: rawResult({
        summary: '<<outcome>>Posted the credit once for payments-api<</outcome>>\nLong notes.',
        verdict: 'green',
      }),
    });
    expect(view).not.toBeNull();
    if (view === null) {
      return;
    }
    render(<DelegationResult result={view} />);

    expect(screen.getByTestId('outcome-line').textContent).toBe(
      'Posted the credit once for payments-api',
    );
    expect(
      screen.getByRole('button', { name: 'Notes, 1 line' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.queryByText(/<<outcome>>/)).toBeNull();
  });

  it('turns a model "Done" into the red outcome when a check failed', () => {
    const view = delegationResultOf({
      result: rawResult({ summary: '<<outcome>>Done<</outcome>>', verdict: 'red' }),
    });
    expect(view).not.toBeNull();
    if (view === null) {
      return;
    }
    render(<DelegationResult result={view} />);

    expect(screen.getByTestId('outcome-line').textContent).toBe('Checks failed: 1');
    expect(view.outcomeLine?.tone).toBe('danger');
  });

  it('draws files, checks and the failing check as chips, not as a stack of rows', () => {
    const view = delegationResultOf({
      result: rawResult({ summary: 'Notes.', verdict: 'red' }),
    });
    expect(view).not.toBeNull();
    if (view === null) {
      return;
    }
    const { container } = render(<DelegationResult result={view} />);

    const chips = screen.getByTestId('reading-chips');
    expect(chips.textContent).toContain('1 file changed');
    expect(chips.textContent).toContain('unit tests');
    expect(container.querySelector('ul')).toBeNull();
  });

  it('opens the notes of a failed result so the reason is not hidden', () => {
    const view = delegationResultOf({
      result: rawResult({ summary: 'The migration lock timed out.', verdict: 'red' }),
    });
    expect(view).not.toBeNull();
    if (view === null) {
      return;
    }
    render(<DelegationResult result={view} />);

    expect(
      screen.getByRole('button', { name: 'Notes, 1 line' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('shows at most four chips and folds the rest behind a count', () => {
    render(
      <DelegationResult
        result={{
          ...resultWith({ summary: null }),
          changedFileCount: 2,
          questions: ['Keep the old column?', 'Backfill now?', 'Drop the index?', 'Ship tonight?'],
        }}
      />,
    );

    const chips = screen.getByTestId('reading-chips');
    expect(chips.textContent).toContain('Drop the index?');
    expect(chips.textContent).not.toContain('Ship tonight?');
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    expect(chips.textContent).toContain('Ship tonight?');
  });
});
