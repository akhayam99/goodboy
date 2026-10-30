// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { TailLine } from './TailLine';
import { TAIL_ACTION } from './tailAction';
import type { TailFacts } from './tailFacts';

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
  describe('a long reason', () => {
    const REASON =
      'Blocked: Auto stopped answering before it replied while it checked the retry ledger in payments-api against the Northwind export.';

    const cutBy = ({ scrollHeight, clientHeight }: Record<string, number>) => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight ?? 0);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight ?? 0);
    };

    const failedFacts = {
      state: 'failed',
      phrase: REASON,
      startedAt: null,
      actions: [TAIL_ACTION.retry, TAIL_ACTION.viewTranscript],
    } satisfies TailFacts;

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('opens the whole reason in a tooltip on keyboard focus when it is cut', async () => {
      cutBy({ scrollHeight: 40, clientHeight: 20 });
      render(<TailLine facts={failedFacts} onAction={() => undefined} />);

      const phrase = screen.getByText(REASON);
      expect(phrase.getAttribute('tabindex')).toBe('0');
      await userEvent.tab();

      expect(document.activeElement).toBe(phrase);
      expect(screen.getByRole('tooltip').textContent).toBe(REASON);
    });

    it('stays out of the tab order and shows no tooltip when the reason fits', async () => {
      cutBy({ scrollHeight: 20, clientHeight: 20 });
      render(<TailLine facts={failedFacts} onAction={() => undefined} />);

      expect(screen.getByText(REASON).getAttribute('tabindex')).toBeNull();
      await userEvent.tab();

      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });
});
