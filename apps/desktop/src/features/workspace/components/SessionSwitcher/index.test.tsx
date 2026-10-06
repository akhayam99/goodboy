// @vitest-environment happy-dom

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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { seedColumn, sessionOf } from '../../testing/sessionColumn';
import { SessionSwitcher } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const today = sessionOf({ goal: 'Fix webhook retries', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const monday = sessionOf({
  goal: 'Ledger export speedup',
  lastOpenedAt: '2026-10-05T09:00:00.000Z',
});
const lastWeek = sessionOf({
  goal: 'Notify relay backoff',
  lastOpenedAt: '2026-09-29T09:00:00.000Z',
});
const idOf = (session: { readonly id: string }) => session.id as SessionId;

const mount = () => {
  seedColumn({
    store: useAppStore,
    sessions: [lastWeek, today, monday],
    currentSessionId: idOf(today),
  });
  return render(<SessionSwitcher />);
};

const press = (id: 'session.switcher' | 'session.switcherBack') => {
  act(() => {
    pressShortcut({ id, target: document.body });
  });
};

const releaseControl = () => {
  act(() => {
    fireEvent.keyUp(window, { key: 'Control', code: 'ControlLeft' });
  });
};

const wait = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const options = () =>
  within(screen.getByRole('listbox', { name: 'Recent sessions' })).getAllByRole('option');

const selectedTitle = () =>
  options()
    .find((option) => option.getAttribute('aria-selected') === 'true')
    ?.textContent?.replace(/\s*(just now|\d+\w ago)$/, '');

const current = () => useAppStore.getState().currentSessionId;

describe('the recent session switcher', () => {
  it('stays hidden for a quick tap and opens the previous session on release', () => {
    mount();
    press('session.switcher');
    expect(screen.queryByRole('listbox')).toBeNull();
    releaseControl();
    expect(current()).toBe(idOf(monday));
  });

  it('shows the sessions in the order you opened them, the open one first', () => {
    mount();
    press('session.switcher');
    wait(120);
    expect(
      options().map((option) => option.textContent?.replace(/\s*(just now|\d+\w ago)$/, '')),
    ).toEqual(['Fix webhook retries', 'Ledger export speedup', 'Notify relay backoff']);
  });

  it('starts on the previous session', () => {
    mount();
    press('session.switcher');
    wait(120);
    expect(selectedTitle()).toBe('Ledger export speedup');
  });

  it('steps with Tab and back with Shift Tab, around the ends', () => {
    mount();
    press('session.switcher');
    wait(120);
    press('session.switcher');
    expect(selectedTitle()).toBe('Notify relay backoff');
    press('session.switcher');
    expect(selectedTitle()).toBe('Fix webhook retries');
    press('session.switcherBack');
    expect(selectedTitle()).toBe('Notify relay backoff');
  });

  it('opens the chosen session when Control is released', () => {
    mount();
    press('session.switcher');
    wait(120);
    press('session.switcher');
    releaseControl();
    expect(current()).toBe(idOf(lastWeek));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does nothing when Escape cancels', () => {
    mount();
    press('session.switcher');
    wait(120);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    releaseControl();
    expect(current()).toBe(idOf(today));
  });

  it('opens a session when its row is clicked', () => {
    mount();
    press('session.switcher');
    wait(120);
    fireEvent.click(screen.getByRole('option', { name: /Notify relay backoff/ }));
    expect(current()).toBe(idOf(lastWeek));
  });

  it('opens from Shift Tab at the oldest session', () => {
    mount();
    press('session.switcherBack');
    wait(120);
    expect(selectedTitle()).toBe('Notify relay backoff');
  });

  it('does not open with a single session', () => {
    seedColumn({ store: useAppStore, sessions: [today], currentSessionId: idOf(today) });
    render(<SessionSwitcher />);
    press('session.switcher');
    wait(120);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('lets a focused terminal keep the key', () => {
    mount();
    const terminal = document.createElement('div');
    terminal.className = 'xterm';
    const field = document.createElement('textarea');
    terminal.append(field);
    document.body.append(terminal);
    field.focus();
    const sent: { event?: KeyboardEvent } = {};
    act(() => {
      sent.event = pressShortcut({ id: 'session.switcher', target: field });
    });
    wait(120);
    expect(sent.event?.defaultPrevented).toBe(false);
    expect(screen.queryByRole('listbox')).toBeNull();
    terminal.remove();
  });

  it('keeps working in the message field of the open session', () => {
    mount();
    const field = document.createElement('textarea');
    document.body.append(field);
    field.focus();
    const sent: { event?: KeyboardEvent } = {};
    act(() => {
      sent.event = pressShortcut({ id: 'session.switcher', target: field });
    });
    expect(sent.event?.defaultPrevented).toBe(true);
    field.remove();
  });
});
