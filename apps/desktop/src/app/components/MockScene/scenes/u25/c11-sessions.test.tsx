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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_C11_SESSIONS_SCENES } from './c11-sessions';

const SETTLE_MS = 2_000;

const LANES = ['building', 'running', 'needs you', 'in review', 'done', 'archived'];

type SceneName = keyof typeof U25_C11_SESSIONS_SCENES;

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

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C11_SESSIONS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const viewSwitch = () => screen.getByRole('tablist', { name: 'Sessions view' });

describe('the c11 Sessions scenes', () => {
  it('are registered under their keys', () => {
    for (const name of Object.keys(U25_C11_SESSIONS_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c11-sessions-board shows the six lanes in pipeline order under one Sessions header', async () => {
    await mount('c11-sessions-board');
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeDefined();
    const labels = screen
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'))
      .filter((label): label is string => label !== null && LANES.includes(label));
    expect(labels).toEqual(LANES);
    expect(
      within(viewSwitch()).getByRole('tab', { name: 'Board' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByText(/repos? needs? attention/)).toBeNull();
    for (const card of screen.getAllByRole('article')) {
      expect(card.querySelectorAll('[data-board-signal]').length).toBeLessThanOrEqual(1);
    }
  });

  it('c11-sessions-board-filtered says how many cards the project filter hides', async () => {
    await mount('c11-sessions-board-filtered');
    expect(screen.getByText(/^\d+ hidden by filters$/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDefined();
  });

  it('c11-sessions-list lays every session on one grid with no lanes', async () => {
    await mount('c11-sessions-list');
    const list = screen.getByRole('list', { name: 'Sessions' });
    expect(list.getAttribute('data-list-grid')).toBe('');
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(3);
    expect(screen.queryByRole('group', { name: 'building' })).toBeNull();
    expect(
      within(viewSwitch()).getByRole('tab', { name: 'List' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('c11-sessions-list-grouped heads each stage group with its count', async () => {
    await mount('c11-sessions-list-grouped');
    expect(screen.getByRole('heading', { level: 2, name: 'Needs you' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Running' })).toBeDefined();
  });

  it('c11-sessions-list-filtered keeps the hidden line under the list', async () => {
    await mount('c11-sessions-list-filtered');
    expect(screen.getByText(/^\d+ hidden by filters$/)).toBeDefined();
  });

  it('c11-sessions-repos-attention shows the one repo pill in the header', async () => {
    await mount('c11-sessions-repos-attention');
    const title = screen.getByRole('heading', { level: 1, name: 'Sessions' });
    const pill = screen.getByText('1 repo needs attention');
    expect(title.parentElement?.contains(pill)).toBe(true);
  });

  it('c11-sessions-empty offers New session under No sessions yet', async () => {
    await mount('c11-sessions-empty');
    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New session' })).toBeDefined();
  });

  it('c11-sessions-hover-facts carries the facts the card dropped, and no actions', async () => {
    await mount('c11-sessions-hover-facts');
    expect(screen.getByText(/Pinned · \d+ agents?/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'What do these marks mean?' })).toBeNull();
  });
});

describe('SPEC3 9.9: every Sessions page capability is reachable from its new home', () => {
  it('Board as a page: the Sessions page Board view, switchable to List and back', async () => {
    await mount('c11-sessions-board');
    fireEvent.click(within(viewSwitch()).getByRole('tab', { name: 'List' }));
    await settle();
    expect(screen.getByRole('list', { name: 'Sessions' })).toBeDefined();
    fireEvent.click(within(viewSwitch()).getByRole('tab', { name: 'Board' }));
    await settle();
    expect(screen.getByRole('group', { name: 'building' })).toBeDefined();
  });

  it('Building and Archived lanes stay, and an archived card keeps Restore', async () => {
    await mount('c11-sessions-board');
    expect(screen.getByRole('group', { name: 'building' })).toBeDefined();
    const archived = screen.getByRole('group', { name: 'archived' });
    expect(within(archived).getAllByRole('button', { name: 'Restore' }).length).toBeGreaterThan(0);
  });

  it('the card PR token, quick action and a visible menu stay on the card', async () => {
    await mount('c11-sessions-board');
    expect(screen.getAllByRole('button', { name: /^Open pull request/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('group', { name: 'Session quick actions' }).length).toBeGreaterThan(
      0,
    );
    const menus = screen.getAllByRole('button', { name: 'Session actions' });
    expect(menus.every((menu) => !menu.className.includes('opacity-0'))).toBe(true);
  });

  it('bulk select: the card tick and Select all reach the selection bar', async () => {
    await mount('c11-sessions-board');
    const [box] = screen.getAllByRole('checkbox');
    if (box === undefined) {
      throw new Error('no card checkbox');
    }
    fireEvent.click(box);
    await settle();
    expect(within(screen.getByRole('toolbar')).getByText('1 selected')).toBeDefined();
  });

  it('project filter, sort and the repo status live in the filter popover', async () => {
    await mount('c11-sessions-board');
    fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Filter sessions' });
    expect(within(dialog).getByRole('group', { name: 'Project' })).toBeDefined();
    expect(within(dialog).getByRole('group', { name: 'Sort' })).toBeDefined();
    expect(within(dialog).getByRole('group', { name: 'Repositories' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Check origin' })).toBeDefined();
    expect(within(dialog).queryByRole('group', { name: 'Status' })).toBeNull();
  });

  it('the List view filter keeps Status, Archive and Group', async () => {
    await mount('c11-sessions-list');
    fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Filter sessions' });
    expect(within(dialog).getByRole('group', { name: 'Status' })).toBeDefined();
    expect(within(dialog).getByRole('group', { name: 'Archive' })).toBeDefined();
    expect(within(dialog).getByRole('group', { name: 'Group' })).toBeDefined();
  });

  it('repo status pill opens the whole repository popover with Update and the detail', async () => {
    await mount('c11-sessions-repos-attention');
    fireEvent.click(screen.getByRole('button', { name: /repository git statuses/ }));
    await settle();
    const popover = screen.getByRole('dialog', { name: 'Repository git statuses' });
    expect(within(popover).getByRole('button', { name: 'Update 1' })).toBeDefined();
  });

  it('a List row opens its session', async () => {
    await mount('c11-sessions-list');
    const [row] = within(screen.getByRole('list', { name: 'Sessions' })).getAllByRole('button');
    if (row === undefined) {
      throw new Error('no list row');
    }
    fireEvent.click(row);
    await settle();
    expect(store.getState().currentSessionId).not.toBeNull();
  });
});
