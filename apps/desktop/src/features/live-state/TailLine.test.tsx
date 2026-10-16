// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { TailLine } from './TailLine';
import { TAIL_ACTION } from './tailAction';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const at = ({ msAgo }: { readonly msAgo: number }) =>
  brandId<IsoDateTime>({ value: new Date(Date.now() - msAgo).toISOString() });

describe('TailLine', () => {
  it('counts the clock from the real start, not from the mount', () => {
    render(
      <TailLine
        facts={{
          state: 'working',
          phrase: 'Running pnpm in payments-api',
          startedAt: at({ msAgo: 72_000 }),
          actions: [TAIL_ACTION.stop],
        }}
        onAction={() => undefined}
      />,
    );
    screen.getByText('Running pnpm in payments-api');
    screen.getByText('1m 12s');
  });

  it('draws a needs-you tail in the warning glyph with its answer first and no clock', () => {
    const { container } = render(
      <TailLine
        facts={{
          state: 'needsYou',
          phrase: 'Waiting for your answer on step 4',
          startedAt: at({ msAgo: 72_000 }),
          actions: [TAIL_ACTION.answer],
        }}
        onAction={() => undefined}
      />,
    );
    expect(
      container.querySelector('[data-tail-state="needsYou"] [aria-label="Needs you"]'),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Answer' }).getAttribute('data-variant')).toBe(
      'secondary',
    );
    expect(screen.queryByText('1m 12s')).toBeNull();
  });

  it('shows no clock in the first second', () => {
    const { container } = render(
      <TailLine
        facts={{
          state: 'working',
          phrase: 'Reading the ledger export',
          startedAt: at({ msAgo: 300 }),
          actions: [],
        }}
        onAction={() => undefined}
      />,
    );
    expect(container.querySelector('.tabular-nums')).toBeNull();
    expect(container.textContent).not.toMatch(/ms|0s/);
  });

  it('runs the action the user pressed', async () => {
    const onAction = vi.fn();
    render(
      <TailLine
        facts={{
          state: 'failed',
          phrase: 'Failed: the provider exited without a response.',
          startedAt: null,
          actions: [TAIL_ACTION.retry, TAIL_ACTION.viewTranscript],
        }}
        onAction={onAction}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'View transcript' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction.mock.calls).toEqual([['viewTranscript'], ['retry']]);
  });

  it('shows no clock for a state that waits for the user', () => {
    render(
      <TailLine
        facts={{
          state: 'stopped',
          phrase: 'Stopped by you',
          startedAt: at({ msAgo: 72_000 }),
          actions: [TAIL_ACTION.continue],
        }}
        onAction={() => undefined}
      />,
    );
    expect(screen.queryByText('1m 12s')).toBeNull();
  });
});
