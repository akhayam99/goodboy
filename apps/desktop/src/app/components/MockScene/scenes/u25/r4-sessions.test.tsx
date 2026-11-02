// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R4_SESSIONS_SCENES } from './r4-sessions';

const SETTLE_MS = 2_000;

const NAMES = ['r4-sidebar-filter', 'r4-sidebar-row-menu'] as const;

type SceneName = (typeof NAMES)[number];

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (name: SceneName): Promise<Element> => {
  const Scene = U25_R4_SESSIONS_SCENES[name];
  const { container } = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await settle();
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const sessionsList = (): HTMLElement => {
  const list = document.querySelector('[data-column-sessions]');
  if (!(list instanceof HTMLElement)) {
    throw new Error('the scene has no sessions list');
  }
  return list;
};

describe('the r4 sessions scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_R4_SESSIONS_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_R4_SESSIONS_SCENES[name]);
    }
  });

  it('r4-sidebar-filter puts the filter on the Sessions door row, never on a row of its own', async () => {
    await mount('r4-sidebar-filter');

    const door = document.querySelector('[data-column-door-row="board"]');
    if (!(door instanceof HTMLElement)) {
      throw new Error('no Sessions door row');
    }
    expect(within(door).getByRole('button', { name: 'Filter sessions' })).toBeDefined();
    expect(within(sessionsList()).queryByRole('button', { name: 'Filter sessions' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Filter sessions' })).toHaveLength(1);
  });

  it('r4-sidebar-filter opens Sort and Group as two value rows, then the filter checkboxes', async () => {
    await mount('r4-sidebar-filter');

    const dialog = screen.getByRole('dialog', { name: 'Filter sessions' });
    const display = within(within(dialog).getByRole('group', { name: 'Display' }));
    expect(display.getByRole('combobox', { name: 'Sort' }).textContent).toContain(
      'Needs you first',
    );
    expect(display.getByRole('combobox', { name: 'Group' })).toBeDefined();
    const filter = within(dialog).getByRole('group', { name: 'Filter' });
    for (const box of within(filter).getAllByRole('checkbox')) {
      expect(box.getAttribute('aria-label')).toMatch(/, \d+$/);
      expect(box.getAttribute('aria-label')).not.toMatch(/, 0$/);
    }
    expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);
  });

  it('r4-sidebar-filter keeps its popover open while the list regroups under it', async () => {
    await mount('r4-sidebar-filter');

    const dialog = screen.getByRole('dialog', { name: 'Filter sessions' });
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Group' }));
    fireEvent.click(screen.getByRole('option', { name: 'Stage' }));
    await settle();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Group' }));
    fireEvent.click(screen.getByRole('option', { name: 'Project' }));
    await settle();

    expect(screen.getByRole('dialog', { name: 'Filter sessions' })).toBe(dialog);
  });

  it('r4-sidebar-row-menu opens the session menu with Pin, Refresh, Rename, Archive and Delete', async () => {
    await mount('r4-sidebar-row-menu');

    const menu = screen.getByRole('menu', { name: 'Session actions' });
    const labels = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('data-menu-label'));
    expect(labels).toEqual(
      expect.arrayContaining(['Pin session', 'Refresh session', 'Rename', 'Archive', 'Delete']),
    );
  });

  it('r4-sidebar-row-menu refreshes the session from the menu', async () => {
    const resyncSession = vi.fn(async () => undefined);
    await mount('r4-sidebar-row-menu');
    store.setState({ resyncSession });

    const menu = screen.getByRole('menu', { name: 'Session actions' });
    const refresh = within(menu)
      .getAllByRole('menuitem')
      .find((item) => item.getAttribute('data-menu-label') === 'Refresh session');
    if (refresh === undefined) {
      throw new Error('no Refresh session item');
    }
    fireEvent.click(refresh);
    await settle();

    expect(resyncSession).toHaveBeenCalledOnce();
  });

  it('r4-sidebar-row-menu keeps the confirm in front of Delete', async () => {
    const deleteTask = vi.fn(async () => undefined);
    await mount('r4-sidebar-row-menu');
    store.setState({ deleteTask });

    const menu = screen.getByRole('menu', { name: 'Session actions' });
    const remove = within(menu)
      .getAllByRole('menuitem')
      .find((item) => item.getAttribute('data-menu-label') === 'Delete');
    if (remove === undefined) {
      throw new Error('no Delete item');
    }
    fireEvent.click(remove);
    await settle();

    expect(screen.getByText('Delete session?')).toBeDefined();
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
