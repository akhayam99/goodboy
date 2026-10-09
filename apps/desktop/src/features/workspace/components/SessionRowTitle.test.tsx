// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { pressShortcut } from '../../../__tests__/helpers/pressKey';
import { renderBar, seedColumn, sessionOf } from '../testing/sessionColumn';
import { SessionSwitcher } from './SessionSwitcher';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T10:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const linked = sessionOf({
  goal: '[HBL-412] Retried webhooks post a second credit',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});
const plain = sessionOf({
  goal: 'Ledger export speedup',
  lastOpenedAt: '2026-10-05T09:00:00.000Z',
});
const unlinkedKey = sessionOf({
  goal: '[HBL-999] Notify relay backoff',
  lastOpenedAt: '2026-10-04T09:00:00.000Z',
});

const task: SessionExternalTask = {
  sessionId: linked.id as SessionId,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  url: 'https://linear.app/harborline/issue/HBL-412',
  title: 'Retried webhooks post a second credit',
  createdAt: '2026-10-01T09:00:00.000Z' as IsoDateTime,
};

const seed = () => {
  seedColumn({
    store: useAppStore,
    sessions: [linked, plain, unlinkedKey],
    currentSessionId: plain.id as SessionId,
  });
  useAppStore.setState({ sessionExternalTasks: { [linked.id]: [task] } });
};

const keysIn = (container: HTMLElement) =>
  within(container)
    .queryAllByTestId('session-row-keys')
    .map((node) => node.textContent);

const rowOf = (name: RegExp): HTMLElement => {
  const row = screen
    .getAllByRole('button', { name })
    .find((button) => button.hasAttribute('data-select-id'));
  if (row === undefined) {
    throw new Error(`no session row ${name}`);
  }
  return row;
};

describe('the ticket key on a session row', () => {
  it('shows the key before the title on the left column row', () => {
    seed();
    renderBar();
    const row = rowOf(/Retried webhooks post a second credit/);
    expect(keysIn(row)).toEqual(['HBL-412']);
    expect(row.textContent).toBe('HBL-412Retried webhooks post a second credit');
  });

  it('shows no key on a session without a linked task', () => {
    seed();
    renderBar();
    expect(keysIn(rowOf(/Ledger export speedup/))).toEqual([]);
  });

  it('keeps a bracketed key that is not a linked task in the title', () => {
    seed();
    renderBar();
    const row = rowOf(/Notify relay backoff/);
    expect(keysIn(row)).toEqual([]);
    expect(row.textContent).toContain('[HBL-999] Notify relay backoff');
  });

  it('shows the key on the switcher row', () => {
    seed();
    render(<SessionSwitcher />);
    act(() => {
      pressShortcut({ id: 'session.switcher', target: document.body });
    });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    const options = within(screen.getByRole('listbox', { name: 'Recent sessions' })).getAllByRole(
      'option',
    );
    const byTitle = (text: string) =>
      options.find((option) => option.textContent?.includes(text)) as HTMLElement;
    expect(keysIn(byTitle('Retried webhooks'))).toEqual(['HBL-412']);
    expect(keysIn(byTitle('Ledger export'))).toEqual([]);
    expect(keysIn(byTitle('Notify relay'))).toEqual([]);
  });

  it('shows the key in the hover card title', () => {
    seed();
    renderBar();
    fireEvent.mouseEnter(rowOf(/Retried webhooks post a second credit/));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const card = screen.getByTestId('session-hover-card');
    expect(keysIn(card)).toEqual(['HBL-412']);
    expect(within(card).getByText('Retried webhooks post a second credit')).toBeDefined();
  });
});
