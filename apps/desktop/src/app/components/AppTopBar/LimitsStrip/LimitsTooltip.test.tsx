// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { limitsChipOf } from '@goodboy/core';
import type { IsoDateTime, ProviderLimits } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

let useAppStore: StoryStore;
let LimitsTooltip: typeof import('./LimitsTooltip').LimitsTooltip;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ LimitsTooltip } = await import('./LimitsTooltip'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const CREDITS = {
  availableCount: 1,
  creditId: null,
  expiresAt: null,
  observedAt: '2026-09-25T11:57:00.000Z' as IsoDateTime,
};

const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const codex = (usedFraction: number): ProviderLimits => ({
  providerId: 'codex',
  plan: 'Plus',
  status: usedFraction >= 1 ? 'reached' : 'ok',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: usedFraction >= 1 ? 'reached' : 'ok',
      usedFraction,
      resetsAt: '2026-10-01T18:12:00.000Z' as IsoDateTime,
    },
  ],
  observedAt: '2026-09-25T11:57:00.000Z' as IsoDateTime,
});

type RenderParams = {
  readonly usedFraction: number;
};

const renderOpen = ({ usedFraction }: RenderParams) => {
  const chip = limitsChipOf({ providerId: 'codex', limits: codex(usedFraction), nowMs: NOW });
  render(
    <LimitsTooltip chip={chip} nowMs={NOW} isOpen>
      <button type="button">codex</button>
    </LimitsTooltip>,
  );
  return within(screen.getByTestId('fact-card'));
};

afterEach(cleanup);

describe('LimitsTooltip', () => {
  it('shows the window as a row with its reset and the update age', () => {
    const card = renderOpen({ usedFraction: 0.4 });

    expect(card.getByText('Codex')).toBeDefined();
    expect(card.getByText('Plus')).toBeDefined();
    expect(card.getByText('Weekly')).toBeDefined();
    expect(card.getByText('40% used')).toBeDefined();
    expect(card.getByText(/resets/)).toBeDefined();
    expect(card.getByText(/Updated 3m ago/)).toBeDefined();
  });

  it('points at the free reset row when codex is out', () => {
    act(() => {
      useAppStore.setState({ codexResetCredits: CREDITS });
    });
    const card = renderOpen({ usedFraction: 1 });

    expect(card.getByText('Free resets')).toBeDefined();
    expect(card.getByText('1 available')).toBeDefined();
  });

  it('keeps quiet about resets while codex still has room', () => {
    act(() => {
      useAppStore.setState({ codexResetCredits: CREDITS });
    });
    const card = renderOpen({ usedFraction: 0.4 });

    expect(card.queryByText('Free resets')).toBeNull();
  });

  it('is described to a screen reader by one sentence', () => {
    renderOpen({ usedFraction: 0.4 });

    const described = screen
      .getByRole('button', { name: 'codex' })
      .getAttribute('aria-describedby');
    expect(described).not.toBeNull();
    expect(document.getElementById(described ?? '')?.textContent).toContain('Weekly, 40% used');
  });
});
