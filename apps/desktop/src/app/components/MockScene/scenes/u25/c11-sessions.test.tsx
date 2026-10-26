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
import { tintClasses, type Tone } from '@goodboy/ui';
import { carriesSpec } from '../../../../../test/classTokens';
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
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
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
    expect(screen.getByText(/^\d+ hidden$/)).toBeDefined();
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

  it('c11-sessions-list splits the rows by the board stages, one stage dot per group and none on a row', async () => {
    await mount('c11-sessions-list');
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '');
    expect(headings).toEqual(['Building', 'Running', 'Needs you', 'In review', 'Done']);
    const TONE_OF_STAGE: Readonly<Record<string, Tone>> = {
      Building: 'neutral',
      Running: 'info',
      'Needs you': 'warning',
      'In review': 'success',
      Done: 'merged',
    };
    const list = screen.getByRole('list', { name: 'Sessions' });
    expect(within(list).queryAllByTestId('tone-bar')).toEqual([]);
    for (const heading of screen.getAllByRole('heading', { level: 2 })) {
      const label = heading.closest('[data-list-grid-group-label]');
      const tone = TONE_OF_STAGE[heading.textContent ?? ''];
      if (label === null || tone === undefined) {
        throw new Error(`no group label for ${heading.textContent ?? ''}`);
      }
      const marks = label.querySelectorAll('[data-list-grid-group-mark] > span');
      expect(marks).toHaveLength(1);
      expect(carriesSpec({ element: marks[0] ?? null, spec: tintClasses(tone).dot })).toBe(true);
      const rows = heading.closest('li')?.querySelectorAll('[data-list-grid-row]') ?? [];
      for (const row of Array.from(rows)) {
        expect(row.querySelectorAll('[data-node-kind]')).toHaveLength(1);
      }
    }
  });

  it('c11-sessions-board draws each card on the track of its lane', async () => {
    await mount('c11-sessions-board');
    const running = screen.getByRole('group', { name: 'running' });
    const tracks = within(running).getAllByTestId('tone-bar');
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.every((track) => track.getAttribute('data-tone') === 'info')).toBe(true);
  });

  it('c11-sessions-list-grouped heads each stage group with its count', async () => {
    await mount('c11-sessions-list-grouped');
    expect(screen.getByRole('heading', { level: 2, name: 'Needs you' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Running' })).toBeDefined();
  });

  it('c11-sessions-list-filtered keeps the hidden line under the list', async () => {
    await mount('c11-sessions-list-filtered');
    expect(screen.getByText(/^\d+ hidden$/)).toBeDefined();
  });

  it('c11-sessions-repos-attention keeps repo state off the filter and the header', async () => {
    await mount('c11-sessions-repos-attention');
    expect(screen.queryByText('1 repo needs attention')).toBeNull();
    expect(document.querySelector('[data-filter-dot]')).toBeNull();
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

describe('every Sessions page capability is reachable from its home', () => {
  it('Board as a page: the Sessions page Board view, switchable to List and back', async () => {
    await mount('c11-sessions-board');
    fireEvent.click(within(viewSwitch()).getByRole('tab', { name: 'List' }));
    await settle();
    expect(screen.getByRole('list', { name: 'Sessions' })).toBeDefined();
    fireEvent.click(within(viewSwitch()).getByRole('tab', { name: 'Board' }));
    await settle();
    expect(screen.getByRole('group', { name: 'building' })).toBeDefined();
  });

  it('the card PR token and quick action stay on the card, the menu on its right click', async () => {
    await mount('c11-sessions-board');
    expect(screen.getAllByRole('button', { name: /^Open pull request/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('group', { name: 'Session quick actions' }).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole('button', { name: 'Session actions' })).toBeNull();
    const [card] = screen.getAllByRole('article');
    if (card === undefined) {
      throw new Error('no board card');
    }
    fireEvent.contextMenu(card);
    await settle();
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(items[0]).toBe('Open');
    expect(items.some((item) => item.startsWith('Archive'))).toBe(true);
  });

  it('bulk select: an Option click on a card reaches the selection bar, with no checkbox', async () => {
    await mount('c11-sessions-board');
    expect(screen.queryByRole('checkbox')).toBeNull();
    const [title] = screen.getAllByRole('button', { pressed: false });
    if (title === undefined) {
      throw new Error('no card title');
    }
    fireEvent.click(title, { altKey: true });
    await settle();
    expect(within(screen.getByRole('toolbar')).getByText('1 selected')).toBeDefined();
  });

  it('project filter and sort live in the filter popover, the repo status does not', async () => {
    await mount('c11-sessions-board');
    fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Filter sessions' });
    expect(within(dialog).getByRole('group', { name: 'Folder' })).toBeDefined();
    expect(within(dialog).getByRole('combobox', { name: 'Sort' })).toBeDefined();
    expect(within(dialog).queryByRole('group', { name: 'Repositories' })).toBeNull();
    expect(within(dialog).queryByRole('group', { name: 'Status' })).toBeNull();
  });

  it('the List view filter keeps Status and Show archived, and no Group: the list groups by stage', async () => {
    await mount('c11-sessions-list');
    fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Filter sessions' });
    expect(within(dialog).getByRole('group', { name: 'Status' })).toBeDefined();
    expect(within(dialog).getByRole('switch', { name: /^Show archived/ })).toBeDefined();
    expect(within(dialog).queryByRole('combobox', { name: 'Group' })).toBeNull();
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
