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
import { harborline, renderBar, seedColumn, sessionOf } from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const one = sessionOf({ goal: 'one', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const two = sessionOf({ goal: 'two', lastOpenedAt: '2026-10-06T08:00:00.000Z' });
const three = sessionOf({ goal: 'x', lastOpenedAt: '2026-10-06T07:00:00.000Z' });
const archivedOne = sessionOf({ goal: 'archived one' });

const rows = (): ReadonlyArray<HTMLElement> =>
  screen.getAllByRole('button').filter((button) => button.hasAttribute('data-select-id'));

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
  it('carries selection on the row and on a checkbox that is not a tab stop', () => {
    mount();
    const box = screen.getByRole('checkbox', { name: 'Select one' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    expect(box.getAttribute('tabindex')).toBe('-1');
    expect(rows()[0]?.getAttribute('aria-keyshortcuts')).toBe('Alt+Enter Alt+Space Shift+F10');
  });

  it('starts a selection from the row checkbox without opening the session', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select one' }));
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Select one' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('extends the selection to a range on a shift-click of a checkbox', () => {
    mount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select one' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select x' }), { shiftKey: true });
    expect(selected(3)).toBeDefined();
  });

  it('selects from the keyboard with alt and Enter', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.keyDown(rows()[0] as HTMLElement, { key: 'Enter', altKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
  });

  it('selects from the keyboard with alt and Space, matching aria-keyshortcuts', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.keyDown(rows()[0] as HTMLElement, { key: ' ', altKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
  });

  it('selects from the row body when a modifier key is held instead of opening the session', () => {
    const onSelectSession = vi.fn();
    mount({ onSelectSession });
    fireEvent.click(screen.getByRole('button', { name: 'one' }), { metaKey: true });
    expect(onSelectSession).not.toHaveBeenCalled();
    expect(selected(1)).toBeDefined();
  });

  it('extends the selection to a range on shift-click of the rows', () => {
    mount();
    fireEvent.click(rows()[0] as HTMLElement, { altKey: true });
    fireEvent.click(rows()[2] as HTMLElement, { shiftKey: true });
    expect(selected(3)).toBeDefined();
  });

  it('toggles aria-pressed and hides the bulk bar when the last selection is removed', () => {
    mount();
    const row = () => rows()[0] as HTMLElement;
    expect(row().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(row(), { altKey: true });
    expect(row().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(row(), { altKey: true });
    expect(row().getAttribute('aria-pressed')).toBe('false');
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
    fireEvent.click(screen.getByRole('button', { name: 'archived one' }));
    expect(onSelectSession).toHaveBeenCalledWith(archivedOne.id);
    expect(screen.getByRole('button', { name: 'archived one' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('selects an archived session together with the live ones and offers the right verbs', () => {
    mount({ archived: true });
    showArchived();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select archived one' }));
    const bar = selected(1);
    expect(within(bar).getByRole('button', { name: 'Restore 1 session' })).toBeDefined();
  });

  it('drops the selection of a session that leaves the list', () => {
    mount({ archived: true });
    showArchived();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select archived one' }));
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: harborline.id,
        patch: { isArchivedShown: false },
      });
    });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
