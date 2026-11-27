// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { createInvokeMock } from '../../../test/invokeMock';
import { useCallQuietStore } from '../../notifications/away/callQuietStore';
import { applyChipInput } from './applyChipInput';
import { useCallChipStore } from './callChipStore';
import type { ChipCall, ChipState } from './callChipTypes';

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 10, 27, 10, 29);

const SYNC: ChipCall = {
  id: 'northwind-sync',
  title: 'Northwind sync',
  start: NOW + MINUTE,
  end: NOW + 31 * MINUTE,
  link: 'https://meet.google.com/abc-defg-hij',
  isLinkTrusted: true,
  people: [],
};

const COUNTDOWN: ChipState = { kind: 'countdown', call: SYNC };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useCallChipStore.setState({ state: COUNTDOWN });
  useCallQuietStore.setState({ quiet: null, held: [] });
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  clearMocks();
  vi.useRealTimers();
});

describe('applyChipInput', () => {
  it('says snoozed only once Rust has armed the snooze', async () => {
    const invoke = createInvokeMock({ handlers: { calendar_alerts_snooze: true } });
    mockIPC(invoke);

    applyChipInput({ input: { kind: 'snooze' }, now: NOW });

    expect(useCallChipStore.getState().state).toBe(COUNTDOWN);
    await waitFor(() =>
      expect(useCallChipStore.getState().state).toEqual({
        kind: 'snoozed',
        call: SYNC,
        until: NOW + 5 * MINUTE,
      }),
    );
    expect(invoke).toHaveBeenCalledWith(
      'calendar_alerts_snooze',
      expect.objectContaining({ eventId: SYNC.id, at: NOW + 5 * MINUTE }),
    );
  });

  it('keeps Join and banners when the system refuses the link, and joins on retry', async () => {
    let isRefused = true;
    const invoke = createInvokeMock({
      handlers: {
        open_url: () => {
          if (isRefused) {
            throw new Error('no browser is installed');
          }
        },
        db_execute: { rowsAffected: 1 },
        db_select: [],
      },
    });
    mockIPC(invoke);

    applyChipInput({ input: { kind: 'join' }, now: NOW });

    await waitFor(() =>
      expect(JSON.stringify(invoke.mock.calls)).toContain("Couldn't open the call link"),
    );
    expect(useCallChipStore.getState().state).toBe(COUNTDOWN);
    expect(useCallQuietStore.getState().quiet).toBeNull();

    isRefused = false;
    applyChipInput({ input: { kind: 'join' }, now: NOW });

    await waitFor(() => expect(useCallChipStore.getState().state.kind).toBe('in-call'));
    expect(useCallQuietStore.getState().quiet).toEqual({ eventId: SYNC.id, until: SYNC.end });
  });

  it('keeps the countdown and says why when Rust no longer knows the call', async () => {
    const invoke = createInvokeMock({
      handlers: {
        calendar_alerts_snooze: false,
        db_execute: { rowsAffected: 1 },
        db_select: [],
      },
    });
    mockIPC(invoke);

    applyChipInput({ input: { kind: 'snooze' }, now: NOW });

    await waitFor(() =>
      expect(JSON.stringify(invoke.mock.calls)).toContain("Couldn't snooze the call"),
    );
    expect(useCallChipStore.getState().state).toBe(COUNTDOWN);
  });
});
