import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';

type ProviderRow = {
  readonly id: ProviderId;
  readonly connection: 'connected' | 'missing' | 'unknown';
};

const { store } = vi.hoisted(() => ({
  store: {
    providers: [] as ReadonlyArray<ProviderRow>,
    providerLimits: {} as Partial<Record<ProviderId, ProviderLimits>>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { LimitsStrip } from './index';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const connected = (ids: ReadonlyArray<ProviderId>): ReadonlyArray<ProviderRow> =>
  (['anthropic', 'cursor', 'codex', 'gemini', 'opencode'] as const).map((id) => ({
    id,
    connection: ids.includes(id) ? 'connected' : 'missing',
  }));

const limits = (patch: Partial<ProviderLimits>): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'Max',
  status: 'ok',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: 0.47,
      resetsAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2026-09-25T11:57:00.000Z' as IsoDateTime,
  ...patch,
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  store.providers = connected(['anthropic', 'codex', 'cursor', 'gemini']);
  store.providerLimits = {};
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const chipButtons = () =>
  within(screen.getByRole('toolbar', { name: 'Provider limits' }))
    .getAllByRole('button')
    .filter((button) => button.getAttribute('data-limits-chip') !== 'overflow');

describe('LimitsStrip', () => {
  it('draws one chip per connected plan provider in a fixed order, no data last', () => {
    store.providers = connected(['anthropic', 'codex', 'cursor', 'gemini', 'opencode']);
    render(<LimitsStrip />);

    expect(chipButtons().map((button) => button.getAttribute('data-limits-chip'))).toEqual([
      'anthropic',
      'codex',
      'cursor',
      'gemini',
    ]);
  });

  it('shows only the bar at rest and the number from 80 percent', () => {
    store.providerLimits = {
      anthropic: limits({}),
      codex: limits({
        providerId: 'codex',
        plan: 'Plus',
        status: 'warning',
        windows: [
          {
            kind: 'fiveHour',
            model: null,
            status: 'warning',
            usedFraction: 0.82,
            resetsAt: '2026-09-25T14:30:00.000Z' as IsoDateTime,
          },
        ],
      }),
    };
    render(<LimitsStrip />);

    const [claude, codex] = chipButtons();
    expect(claude?.textContent).toBe('');
    expect(claude?.getAttribute('aria-label')).toContain('Claude Max · 47% of the week used');
    expect(codex?.textContent).toBe('5h 82%');
    expect(codex?.getAttribute('aria-label')).toContain('Codex is about to run out');
  });

  it('stacks the 5-hour bar over the weekly bar in one chip', () => {
    store.providerLimits = {
      anthropic: limits({
        status: 'warning',
        windows: [
          {
            kind: 'weekly',
            model: null,
            status: 'warning',
            usedFraction: 0.94,
            resetsAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
          },
          {
            kind: 'fiveHour',
            model: null,
            status: 'ok',
            usedFraction: 0.04,
            resetsAt: '2026-09-25T14:30:00.000Z' as IsoDateTime,
          },
        ],
      }),
    };
    render(<LimitsStrip />);

    const [claude] = chipButtons();
    const tracks = [...(claude?.querySelectorAll('[data-limits-track]') ?? [])];
    expect(tracks.map((track) => track.getAttribute('data-limits-track'))).toEqual([
      'fiveHour',
      'weekly',
    ]);
    expect(tracks.map((track) => (track.firstElementChild as HTMLElement).style.width)).toEqual([
      '4%',
      '94%',
    ]);
    expect(claude?.textContent).toBe('wk 94%');
  });

  it('says out with the reset day when the provider stopped', () => {
    store.providerLimits = {
      codex: limits({
        providerId: 'codex',
        status: 'reached',
        windows: [
          {
            kind: 'weekly',
            model: null,
            status: 'reached',
            usedFraction: 1,
            resetsAt: '2026-10-01T18:12:00.000Z' as IsoDateTime,
          },
        ],
      }),
    };
    render(<LimitsStrip />);

    const codex = chipButtons().find(
      (button) => button.getAttribute('data-limits-chip') === 'codex',
    );
    expect(codex?.textContent).toMatch(/^Out· \S+$/);
    expect(codex?.getAttribute('aria-label')).toContain('Codex is out for the week');
  });

  it('shows the fewest chips below chrome-labels and moves the rest into +N', () => {
    render(<LimitsStrip />);

    const buttons = chipButtons();
    expect(buttons[0]?.className).toContain('flex');
    expect(buttons[0]?.className).not.toContain('hidden');
    expect(buttons[1]?.className).toContain('@min-chrome-labels/topbar:flex');
    expect(buttons[2]?.className).toContain('@min-chrome-wide/topbar:flex');
    expect(screen.getByRole('button', { name: '3 more providers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2 more providers' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '0 more providers' })).toBeNull();
  });

  it('gives +N the tone of the worst hidden provider and lists them', () => {
    store.providers = connected(['anthropic', 'codex']);
    store.providerLimits = {
      codex: limits({
        providerId: 'codex',
        windows: [
          {
            kind: 'weekly',
            model: null,
            status: 'reached',
            usedFraction: 1,
            resetsAt: '2026-10-01T18:12:00.000Z' as IsoDateTime,
          },
        ],
      }),
    };
    render(<LimitsStrip />);

    const overflow = screen.getByRole('button', { name: '1 more provider' });
    expect(overflow.querySelector('svg')?.getAttribute('class')).toContain('text-danger');
    fireEvent.click(overflow);
    expect(screen.getByRole('list', { name: 'More provider limits' }).textContent).toContain(
      'Codex',
    );
  });

  it('moves between chips with the arrow keys', () => {
    render(<LimitsStrip />);
    const buttons = chipButtons();
    buttons[0]?.focus();

    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'ArrowLeft' });
    const everyButton = within(screen.getByRole('toolbar')).getAllByRole('button');
    expect(document.activeElement).toBe(everyButton[everyButton.length - 1]);
  });

  it('presses the chip of the provider open in settings and opens its usage on click', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);
    render(<LimitsStrip openProviderId="codex" />);

    const codex = chipButtons().find(
      (button) => button.getAttribute('data-limits-chip') === 'codex',
    );
    expect(codex?.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chipButtons()[0] as HTMLElement);
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ scope: 'providers', provider: 'anthropic', section: 'usage' });
    window.removeEventListener('goodboy:open-settings', listener);
  });

  it('asks to connect a provider when none is connected', () => {
    store.providers = connected([]);
    render(<LimitsStrip />);

    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect a provider' })).toBeTruthy();
  });

  it('draws nothing while providers are still being detected', () => {
    store.providers = [{ id: 'anthropic', connection: 'unknown' }];
    const { container } = render(<LimitsStrip />);

    expect(container.textContent).toBe('');
  });
});
