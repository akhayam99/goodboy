// @vitest-environment happy-dom

const { summaryReads } = vi.hoisted(() => ({ summaryReads: { current: 0 } }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../hooks/useSessionSummary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useSessionSummary')>();
  return {
    ...actual,
    useSessionSummary: (params: Parameters<typeof actual.useSessionSummary>[0]) => {
      summaryReads.current += 1;
      return actual.useSessionSummary(params);
    },
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { renderBar, seedColumn, sessionOf } from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  summaryReads.current = 0;
});

afterEach(cleanup);

const sessions = Array.from({ length: 8 }, (_, index) =>
  sessionOf({
    goal: `session ${index}`,
    lastOpenedAt: `2026-10-06T${String(20 - index).padStart(2, '0')}:00:00.000Z`,
  }),
);

const mount = (currentSessionId: SessionId | null) => {
  seedColumn({ store: useAppStore, sessions, currentSessionId });
  return renderBar();
};

describe('what a session row re-renders on', () => {
  it('only the rows that gain or lose the open mark when the open session changes', () => {
    mount(sessions[0]?.id as SessionId);
    summaryReads.current = 0;
    act(() => {
      useAppStore.setState({ currentSessionId: sessions[1]?.id as SessionId });
    });
    expect(summaryReads.current).toBe(2);
  });

  it('only the toggled row when one row joins the selection', () => {
    mount(null);
    summaryReads.current = 0;
    const row = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-select-id'))[3] as HTMLElement;
    fireEvent.click(row, { altKey: true });
    expect(summaryReads.current).toBe(1);
  });

  it('no row when the hover card opens and closes', () => {
    mount(null);
    summaryReads.current = 0;
    const row = screen.getByRole('button', { name: 'session 2' });
    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);
    expect(summaryReads.current).toBe(0);
  });
});
