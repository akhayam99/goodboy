// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U42_SIDEBAR_FRAME_SCENES } from './sidebar-frame';

const SETTLE_MS = 2_000;

const NAMES = ['sidebar-frame-dark', 'sidebar-frame-light'] as const;

type SceneName = (typeof NAMES)[number];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<HTMLElement> => {
  const Scene = U42_SIDEBAR_FRAME_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  render(<Scene />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return screen.getByRole('navigation', { name: 'Sidebar' });
};

const rowOf = (sidebar: HTMLElement, title: string): HTMLElement => {
  const row = within(sidebar)
    .getAllByRole('option')
    .find((option) => option.textContent?.includes(title) === true);
  if (row === undefined) {
    throw new Error(`no row for ${title}`);
  }
  return row;
};

describe('the sidebar frame scenes', () => {
  it('registers both themes', () => {
    expect(Object.keys(U42_SIDEBAR_FRAME_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it.each(NAMES)(
    '%s opens the column on the frame row, then the nav block, then the lists',
    async (name) => {
      const sidebar = await mount(name);
      const frameRow = sidebar.querySelector('[data-frame-row]');
      expect(frameRow?.querySelector('[data-create="session"]')).not.toBeNull();
      expect(sidebar.querySelector('[data-column-nav]')?.firstElementChild).toBe(frameRow);
      for (const label of ['Pinned', 'Sessions', 'Done']) {
        expect(within(sidebar).getByText(label)).toBeDefined();
      }
    },
  );

  it.each(NAMES)('%s keys a ticket row in its own span and marks unread by a dot', async (name) => {
    const sidebar = await mount(name);
    const keys = within(sidebar)
      .getAllByTestId('session-row-keys')
      .map((key) => key.textContent);
    expect(keys).toEqual(expect.arrayContaining(['NW-142', 'ACME-87']));

    const unread = rowOf(sidebar, 'Per-tenant limits on the public API');
    expect(unread.hasAttribute('data-unread')).toBe(true);
    expect(unread.querySelector('[data-unread-dot], [aria-label$=", unseen"]')).not.toBeNull();

    const read = rowOf(sidebar, 'Draft the payout delay notice');
    expect(read.hasAttribute('data-unread')).toBe(false);
    expect(read.querySelector('[data-unread-dot], [aria-label$=", unseen"]')).toBeNull();
  });

  it.each(NAMES)('%s ends every row and every door on the trailing mark column', async (name) => {
    const sidebar = await mount(name);
    for (const row of within(sidebar).getAllByRole('option')) {
      expect(row.lastElementChild?.hasAttribute('data-row-state')).toBe(true);
    }
    for (const door of sidebar.querySelectorAll('[data-column-door]')) {
      expect(door.lastElementChild?.getAttribute('data-door-slot')).toBe('signal');
    }
  });
});
