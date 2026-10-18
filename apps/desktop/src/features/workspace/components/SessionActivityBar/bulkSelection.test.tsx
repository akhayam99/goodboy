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
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { sessionObjectKey } from '../../../actions/kinds/session';
import { requestSelect } from '../../../actions/selectRequest';
import { harborline, renderBar, seedColumn, sessionOf } from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.useFakeTimers({ now: Date.parse('2026-10-03T12:00:00.000Z'), toFake: ['Date'] });
  await resetStoryStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const one = sessionOf({ goal: 'one', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const two = sessionOf({ goal: 'two', lastOpenedAt: '2026-10-06T08:00:00.000Z' });
const three = sessionOf({ goal: 'x', lastOpenedAt: '2026-10-06T07:00:00.000Z' });
const archivedOne = sessionOf({ goal: 'archived one' });

const rows = (): ReadonlyArray<HTMLElement> =>
  screen.getAllByRole('option').filter((option) => option.hasAttribute('data-select-id'));

const rowAt = (index: number): HTMLElement => {
  const row = rows()[index];
  if (row === undefined) {
    throw new Error(`no session row at ${index}`);
  }
  return row;
};

const mount = (
  options: { readonly archived?: boolean; readonly onSelectSession?: () => void } = {},
) => {
  seedColumn({
    store: useAppStore,
    sessions: [one, two, three],
    archived: options.archived === true ? [archivedOne] : [],
  });
  return renderBar(
    options.onSelectSession === undefined ? {} : { onSelectSession: options.onSelectSession },
  );
};

const showArchived = () => {
  act(() => {
    useAppStore.getState().setSessionViewPrefs({
      workspaceId: harborline.id,
      patch: { isArchivedShown: true },
    });
  });
};

const selected = (count: number) => screen.getByRole('toolbar', { name: `${count} selected` });

describe('bulk selection in the session list', () => {
  it('draws no checkbox anywhere and carries the selection on the option', () => {
    mount();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(rows()[0]?.getAttribute('aria-selected')).toBe('false');
    expect(rows()[0]?.getAttribute('aria-keyshortcuts')).toBe(
      'Alt+Enter Alt+Space Shift+Enter Shift+F10',
    );
  });

  it('lists the rows in a multiselectable listbox of options', () => {
    mount();
    const list = screen.getByRole('listbox');
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    expect(within(list).getAllByRole('option')).toHaveLength(3);
  });

  it('says how to select more while nothing is selected, and drops the hint once something is', () => {
    mount();
    expect(screen.getByText('Shift click for a range, Option click to add one')).toBeDefined();
    fireEvent.click(rowAt(0), { altKey: true });
    expect(screen.queryByText('Shift click for a range, Option click to add one')).toBeNull();
  });

  it('starts a selection from an Option click without opening the session', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.click(rowAt(0), { altKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
    expect(rows()[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('announces the count politely as sessions join the selection', () => {
    mount();
    fireEvent.click(rowAt(0), { altKey: true });
    fireEvent.click(rowAt(1), { metaKey: true });
    const dock = selected(2).closest('[aria-live]');
    expect(dock?.getAttribute('aria-live')).toBe('polite');
    expect(dock?.textContent).toContain('2 selected');
  });

  it('extends the selection to a range with Shift Enter from the keyboard', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.keyDown(rowAt(0), { key: 'Enter', altKey: true });
    fireEvent.keyDown(rowAt(2), { key: 'Enter', shiftKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(3)).toBeDefined();
  });

  it('extends the selection one row at a time with Shift and the arrow keys', () => {
    mount();
    const first = rowAt(0);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown', shiftKey: true });
    expect(selected(2)).toBeDefined();
    expect(document.activeElement).toBe(rows()[1]);
    fireEvent.keyDown(rowAt(1), { key: 'ArrowDown', shiftKey: true });
    expect(selected(3)).toBeDefined();
    fireEvent.keyDown(rowAt(2), { key: 'ArrowUp', shiftKey: true });
    expect(selected(2)).toBeDefined();
  });

  it('moves focus without selecting on a plain arrow key', () => {
    mount();
    const first = rowAt(0);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows()[1]);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('selects the row a Select menu item names, and only that row', () => {
    mount();
    const anchorKey = `sidebar:${two.id}`;
    act(() => {
      requestSelect({ objectKey: sessionObjectKey({ sessionId: two.id }), anchorKey });
    });
    expect(selected(1)).toBeDefined();
    expect(rows()[1]?.getAttribute('aria-selected')).toBe('true');
    expect(rows()[0]?.getAttribute('aria-selected')).toBe('false');
  });

  it('selects from the keyboard with alt and Enter', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.keyDown(rowAt(0), { key: 'Enter', altKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
  });

  it('selects from the keyboard with alt and Space, matching aria-keyshortcuts', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.keyDown(rowAt(0), { key: ' ', altKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
  });

  it('selects from the row body when a modifier key is held instead of opening the session', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.click(screen.getByRole('option', { name: 'one' }), { metaKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
  });

  it('extends the selection to a range on shift-click of the rows', () => {
    mount();
    fireEvent.click(rowAt(0), { altKey: true });
    fireEvent.click(rowAt(2), { shiftKey: true });
    expect(selected(3)).toBeDefined();
  });

  it('toggles aria-selected and hides the bulk bar when the last selection is removed', () => {
    mount();
    const row = () => rowAt(0);
    expect(row().getAttribute('aria-selected')).toBe('false');
    fireEvent.click(row(), { altKey: true });
    expect(row().getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row(), { altKey: true });
    expect(row().getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('shows no bulk action bar when nothing is selected', () => {
    mount({ archived: true });
    showArchived();
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('opens an archived session on a body click without toggling its selection', () => {
    const onSelectSession = vi.fn();
    mount({ archived: true, onSelectSession });
    showArchived();
    fireEvent.click(screen.getByRole('option', { name: 'archived one' }));
    expect(onSelectSession).toHaveBeenCalledWith(archivedOne.id);
    expect(screen.getByRole('option', { name: 'archived one' }).getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('selects an archived session together with the live ones and offers the right verbs', () => {
    mount({ archived: true });
    showArchived();
    fireEvent.click(screen.getByRole('option', { name: 'archived one' }), { altKey: true });
    const bar = selected(1);
    expect(within(bar).getByRole('button', { name: 'Restore 1 session' })).toBeDefined();
  });

  it('drops the selection of a session that leaves the list', () => {
    mount({ archived: true });
    showArchived();
    fireEvent.click(screen.getByRole('option', { name: 'archived one' }), { altKey: true });
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: harborline.id,
        patch: { isArchivedShown: false },
      });
    });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
