// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { createInvokeMock } from '../../../test/invokeMock';
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
});

afterEach(() => {
  clearMocks();
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
