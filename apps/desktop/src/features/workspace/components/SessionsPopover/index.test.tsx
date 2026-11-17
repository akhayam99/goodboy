// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listLiveSessionIds: vi.fn(async () => []),
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { listLiveSessionIds } from '@goodboy/db';
import { brandId, type Session, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import {
  harborline,
  ledgerCore,
  notifyRelay,
  paymentsApi,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';
import { SessionsPopover } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

let storedPins: string | null = null;

type WriteParams = {
  readonly params: unknown;
};

const writtenValueOf = ({ params }: WriteParams): string | null =>
  typeof params === 'object' &&
  params !== null &&
  'value' in params &&
  typeof params.value === 'string'
    ? params.value
    : null;

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  storedPins = null;
  storySpies.getWorkspaceValue.mockImplementation(async () => storedPins);
  storySpies.insertWorkspaceValueIfAbsent.mockImplementation(async (params) => {
    storedPins = writtenValueOf({ params });
    return true;
  });
  storySpies.replaceWorkspaceValueIfUnchanged.mockImplementation(async (params) => {
    storedPins = writtenValueOf({ params });
    return true;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ask = sessionOf({ goal: 'Warn merchants before a payout hold' });
const running = sessionOf({ goal: 'Speed up the payout export', state: runningState() });
const pinned = sessionOf({ goal: 'Stop retried webhooks posting twice' });
const quiet = sessionOf({ goal: 'Rotate the processor signing secret' });

type IdParams = {
  readonly session: Session;
};

const idOf = ({ session }: IdParams): SessionId => brandId<SessionId>({ value: session.id });

const mount = () => {
  seedColumn({
    store: useAppStore,
    sessions: [ask, running, pinned, quiet],
    questions: [ask],
    mounts: [
      [ask, notifyRelay],
      [running, ledgerCore],
      [pinned, paymentsApi],
      [quiet, paymentsApi],
    ],
  });
  const pins = [{ id: idOf({ session: pinned }), at: 1 }];
  storedPins = JSON.stringify(pins);
  vi.mocked(listLiveSessionIds).mockResolvedValue(
    [ask, running, pinned, quiet].map((session) => idOf({ session })),
  );
  useAppStore.setState({ boardReady: true, sessionPins: { [harborline.id]: pins } });
  return render(<SessionsPopover />);
};

const toggle = () => {
  act(() => {
    pressShortcut({ id: 'sessions.toggle', target: document.body });
  });
};

const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Sessions' });

const groupNames = (): ReadonlyArray<string> =>
  within(dialog())
    .getAllByRole('group')
    .map((group) => group.firstElementChild?.textContent ?? '');

type GroupParams = {
  readonly name: RegExp;
};

const titlesIn = ({ name }: GroupParams): ReadonlyArray<string> =>
  within(within(dialog()).getByRole('group', { name }))
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');

const search = (): HTMLElement =>
  within(dialog()).getByRole('combobox', { name: 'Find a session' });

describe('the Sessions popover in the bar', () => {
  it('opens and closes with the Sessions key from anywhere', () => {
    mount();
    expect(screen.queryByRole('dialog', { name: 'Sessions' })).toBeNull();

    toggle();
    dialog();
    expect(screen.getByRole('button', { name: 'Sessions' }).getAttribute('aria-expanded')).toBe(
      'true',
    );

    toggle();
    expect(screen.queryByRole('dialog', { name: 'Sessions' })).toBeNull();
  });

  it('puts Pinned first, then the sessions by state with their counts', () => {
    mount();
    toggle();

    expect(groupNames()).toEqual(['Pinned1', 'Needs you1', 'Running1', 'Building1']);
    expect(titlesIn({ name: /^Pinned/ })).toEqual([
      expect.stringContaining('Stop retried webhooks posting twice'),
    ]);
    expect(titlesIn({ name: /^Needs you/ })[0]).toContain('notify-relay');
  });

  it('filters by title or project as you type and says when nothing matches', () => {
    mount();
    toggle();

    fireEvent.change(search(), { target: { value: 'payout' } });
    expect(within(dialog()).getAllByRole('option')).toHaveLength(2);
    expect(groupNames()).toEqual(['Needs you1', 'Running1']);

    fireEvent.change(search(), { target: { value: 'payments-api' } });
    expect(within(dialog()).getAllByRole('option')).toHaveLength(2);

    fireEvent.change(search(), { target: { value: 'nothing like this' } });
    expect(within(dialog()).queryAllByRole('option')).toHaveLength(0);
    within(dialog()).getByText('No session matches nothing like this');
  });

  it('opens the active row with Enter after the arrows move it, and closes', () => {
    mount();
    toggle();

    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    const options = within(dialog()).getAllByRole('option');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(search().getAttribute('aria-activedescendant')).toBe(options[1]?.id);

    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(useAppStore.getState().currentSessionId).toBe(idOf({ session: ask }));
    expect(screen.queryByRole('dialog', { name: 'Sessions' })).toBeNull();
  });

  it('moves a row into Pinned with its pin and back out again', async () => {
    mount();
    toggle();
    const quietRow = within(dialog())
      .getAllByRole('option')
      .find((option) => option.textContent?.includes('Rotate the processor') === true);
    const pin = quietRow?.querySelector<HTMLElement>('[data-sessions-pin="off"]');
    expect(pin).not.toBeNull();
    if (pin == null) {
      return;
    }

    fireEvent.click(pin);

    await waitFor(() =>
      expect(titlesIn({ name: /^Pinned/ })).toEqual([
        expect.stringContaining('Stop retried webhooks'),
        expect.stringContaining('Rotate the processor'),
      ]),
    );
    screen.getByRole('dialog', { name: 'Sessions' });
    expect(useAppStore.getState().currentSessionId).toBeNull();

    const unpin = within(within(dialog()).getByRole('group', { name: /^Pinned/ }))
      .getAllByRole('option')[1]
      ?.querySelector<HTMLElement>('[data-sessions-pin="on"]');
    if (unpin == null) {
      throw new Error('the pinned row has no pin');
    }
    fireEvent.click(unpin);

    await waitFor(() => expect(titlesIn({ name: /^Building/ })).toHaveLength(1));
  });

  it('leaves the row where it was when the pin cannot be saved', async () => {
    storySpies.replaceWorkspaceValueIfUnchanged.mockResolvedValue(false);
    mount();
    toggle();
    const pin = within(within(dialog()).getByRole('group', { name: /^Building/ }))
      .getAllByRole('option')[0]
      ?.querySelector<HTMLElement>('[data-sessions-pin="off"]');
    if (pin == null) {
      throw new Error('the building row has no pin');
    }

    await act(async () => {
      fireEvent.click(pin);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(storySpies.replaceWorkspaceValueIfUnchanged).toHaveBeenCalledTimes(2),
    );
    expect(titlesIn({ name: /^Building/ })).toEqual([
      expect.stringContaining('Rotate the processor'),
    ]);
    expect(
      (useAppStore.getState().sessionPins[harborline.id] ?? []).map((pinEntry) => pinEntry.id),
    ).not.toContain(idOf({ session: quiet }));
  });
});
