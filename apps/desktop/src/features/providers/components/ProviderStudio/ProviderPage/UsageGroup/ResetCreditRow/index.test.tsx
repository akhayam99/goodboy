// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CodexResetCredits, IsoDateTime, ProviderLimits } from '@goodboy/types';

type Consume = () => Promise<'reset' | 'nothingToReset' | 'noCredit' | 'failed'>;

const { state } = vi.hoisted(() => ({
  state: {
    codexResetCredits: null as CodexResetCredits | null,
    providerLimits: {} as Record<string, ProviderLimits>,
    consumeCodexResetCredit: vi.fn<Consume>(async () => 'reset'),
    refreshCodexLimits: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

import { ResetCreditRow } from './index';

const NOW = Date.parse('2026-09-26T14:00:00.000Z');

const at = (hours: number): IsoDateTime =>
  new Date(NOW + hours * 60 * 60 * 1000).toISOString() as IsoDateTime;

const codexLimits = ({ week }: { readonly week: number }): ProviderLimits => ({
  providerId: 'codex',
  plan: 'Plus',
  status: 'reached',
  windows: [
    { kind: 'fiveHour', model: null, status: 'reached', usedFraction: 1, resetsAt: at(2) },
    { kind: 'weekly', model: null, status: 'ok', usedFraction: week, resetsAt: at(72) },
  ],
  observedAt: at(0),
});

beforeEach(() => {
  state.codexResetCredits = {
    availableCount: 1,
    creditId: 'credit-1',
    expiresAt: '2026-10-03T12:00:00.000Z' as IsoDateTime,
    observedAt: at(0),
  };
  state.providerLimits = { codex: codexLimits({ week: 0.96 }) };
  state.consumeCodexResetCredit.mockReset();
  state.consumeCodexResetCredit.mockResolvedValue('reset');
  state.refreshCodexLimits.mockClear();
});

afterEach(cleanup);

describe('ResetCreditRow', () => {
  it('offers the free reset with its expiry', () => {
    render(<ResetCreditRow nowMs={NOW} />);

    expect(screen.getByText('1 free reset')).toBeDefined();
    expect(
      screen.getByText('Puts the 5-hour window and the week back to 0%. Expires Oct 3.'),
    ).toBeDefined();
  });

  it('confirms in place when the week is almost used, then says it worked', async () => {
    render(<ResetCreditRow nowMs={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use reset' }));
    const confirm = screen.getByRole('group', { name: 'Use your free reset now?' });
    expect(within(confirm).getByText('5h 100% · week 96%')).toBeDefined();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Use reset' }));

    await waitFor(() => expect(screen.getByText('Reset used')).toBeDefined());
    expect(state.consumeCodexResetCredit).toHaveBeenCalledTimes(1);
  });

  it('stops hard when most of the week is left, with keep as the default', () => {
    state.providerLimits = { codex: codexLimits({ week: 0.18 }) };
    render(<ResetCreditRow nowMs={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use reset' }));
    const stop = screen.getByRole('group', { name: 'You still have 82% of this week left' });
    const keep = within(stop).getByRole('button', { name: 'Keep my reset' });
    const anyway = within(stop).getByRole('button', { name: 'Use reset anyway' });
    expect(document.activeElement).toBe(keep);
    expect(anyway.hasAttribute('disabled')).toBe(true);

    fireEvent.click(
      within(stop).getByText("I understand I'm spending my only reset with 82% of the week left."),
    );
    expect(anyway.hasAttribute('disabled')).toBe(false);

    fireEvent.click(keep);
    expect(state.consumeCodexResetCredit).not.toHaveBeenCalled();
    expect(screen.getByText('1 free reset')).toBeDefined();
  });

  it('keeps the confirm open with a retry when codex cannot be reached', async () => {
    state.consumeCodexResetCredit.mockResolvedValueOnce('failed');
    render(<ResetCreditRow nowMs={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use reset' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Use your free reset now?' })).getByRole('button', {
        name: 'Use reset',
      }),
    );

    await waitFor(() => expect(screen.getByText("Couldn't reach Codex.")).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Reset used')).toBeDefined());
    expect(state.consumeCodexResetCredit).toHaveBeenCalledTimes(2);
  });

  it('says so when codex has nothing to reset', async () => {
    state.consumeCodexResetCredit.mockResolvedValueOnce('nothingToReset');
    render(<ResetCreditRow nowMs={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use reset' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Use your free reset now?' })).getByRole('button', {
        name: 'Use reset',
      }),
    );

    await waitFor(() => expect(screen.getByText('Nothing to reset right now')).toBeDefined());
  });

  it('asks codex for the credit details when only the count is known', () => {
    state.codexResetCredits = {
      availableCount: 1,
      creditId: null,
      expiresAt: null,
      observedAt: at(0),
    };
    render(<ResetCreditRow nowMs={NOW} />);

    expect(state.refreshCodexLimits).toHaveBeenCalledWith({ withResetDetails: true });
  });

  it('shows nothing without a free reset', () => {
    state.codexResetCredits = null;
    const { container } = render(<ResetCreditRow nowMs={NOW} />);
    expect(container.textContent).toBe('');
  });
});
