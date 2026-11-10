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
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_C11_SESSIONS_SCENES } from './c11-sessions';

const SETTLE_MS = 2_000;

const LANES = ['building', 'running', 'needs you', 'in review', 'done', 'archived'];

type SceneName = keyof typeof U25_C11_SESSIONS_SCENES;

beforeAll(async () => {
  await importStore();
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

describe('the c11 Sessions scenes', () => {
  it('are registered under their keys', () => {
    for (const name of Object.keys(U25_C11_SESSIONS_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c11-sessions-board shows the six lanes in pipeline order under one Sessions header', async () => {
    await mount('c11-sessions-board');
    expect(screen.getByRole('heading', { level: 1, name: 'Board' })).toBeDefined();
    const labels = screen
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'))
      .filter((label): label is string => label !== null && LANES.includes(label));
    expect(labels).toEqual(LANES);
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

  it('c11-sessions-board draws each card on the track of its lane', async () => {
    await mount('c11-sessions-board');
    const running = screen.getByRole('group', { name: 'running' });
    const tracks = within(running).getAllByTestId('tone-bar');
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.every((track) => track.getAttribute('data-tone') === 'info')).toBe(true);
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
    expect(items[0]).toBe('Go to');
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
    expect(within(dialog).getByRole('group', { name: 'Project' })).toBeDefined();
    expect(within(dialog).getByRole('combobox', { name: 'Sort' })).toBeDefined();
    expect(within(dialog).queryByRole('group', { name: 'Repositories' })).toBeNull();
    expect(within(dialog).queryByRole('group', { name: 'Status' })).toBeNull();
  });
});
