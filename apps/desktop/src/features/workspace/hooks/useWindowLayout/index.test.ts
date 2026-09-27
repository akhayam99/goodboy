// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  saved: [] as Array<{ label: string; workspaceId: string }>,
  forgotten: [] as string[],
  closeHandlers: [] as Array<() => void>,
}));

vi.mock('../../windowLayout', () => ({
  saveWindowLayout: vi.fn(async (layout: { label: string; workspaceId: string }) => {
    h.saved.push(layout);
  }),
  forgetWindowLayout: vi.fn(async ({ label }: { label: string }) => {
    h.forgotten.push(label);
  }),
}));
vi.mock('../../window', () => ({
  currentWindowLabel: () => 'win-7',
  onWindowClose: vi.fn(async (callback: () => void) => {
    h.closeHandlers.push(callback);
    return () => undefined;
  }),
}));

import { useAppStore } from '../../../../store';
import { WINDOW_LAYOUT_SAVE_DELAY_MS, useWindowLayout } from '.';

const WS = 'ws-harborline' as WorkspaceId;
const SESSION = 'session-ledger' as SessionId;

beforeEach(() => {
  vi.useFakeTimers();
  h.saved = [];
  h.forgotten = [];
  h.closeHandlers = [];
  useAppStore.setState({ hydrated: true, currentWorkspaceId: WS, currentSessionId: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWindowLayout', () => {
  it('saves where the window is once the moves settle', async () => {
    renderHook(() => useWindowLayout());
    act(() => {
      useAppStore.setState({ currentSessionId: SESSION });
      useAppStore.setState({ activeLens: { [SESSION]: 'review' } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WINDOW_LAYOUT_SAVE_DELAY_MS);
    });

    expect(h.saved).toHaveLength(1);
    expect(h.saved[0]).toMatchObject({
      label: 'win-7',
      workspaceId: WS,
      location: {
        place: { at: 'session', sessionId: SESSION, view: { lens: 'review' } },
      },
    });
  });

  it('ignores store writes that do not move the window', async () => {
    renderHook(() => useWindowLayout());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WINDOW_LAYOUT_SAVE_DELAY_MS);
    });
    h.saved = [];
    act(() => {
      useAppStore.setState({ transcripts: {} });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WINDOW_LAYOUT_SAVE_DELAY_MS);
    });

    expect(h.saved).toEqual([]);
  });

  it('forgets the window the user closes', async () => {
    renderHook(() => useWindowLayout());
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      h.closeHandlers.forEach((handler) => handler());
    });

    expect(h.forgotten).toEqual(['win-7']);
  });
});
