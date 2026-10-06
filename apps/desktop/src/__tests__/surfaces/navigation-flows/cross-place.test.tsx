// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { pressShortcut } from '../../helpers/pressKey';
import {
  WAIT,
  boot,
  bridge,
  click,
  clickButton,
  consoleErrors,
  heading,
  installNavigationHooks,
  openCrumb,
  openPalette,
  settle,
  useAppStore,
  type BridgeArgs,
} from './harness';

installNavigationHooks();

const JOURNEY_MS = 60_000;

const door = (id: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(
    `[data-side-column] [data-column-layer="nav"] [data-column-door="${id}"], [data-column-rail] [data-column-door="${id}"]`,
  );
  expect(found, `no ${id} door in the column or the rail`).not.toBeNull();
  return found as HTMLElement;
};

const historyButton = (verb: 'Back' | 'Forward'): HTMLElement => {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-cluster] button'),
  ).find((button) => (button.getAttribute('aria-label') ?? '').startsWith(verb));
  expect(found).toBeDefined();
  return found as HTMLElement;
};

const press = async (id: ShortcutId): Promise<void> => {
  const anchor = await screen.findByRole('button', { name: /^Search or ask/ });
  anchor.focus();
  pressShortcut({ id });
  await settle();
};

const escape = async (): Promise<void> => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await settle(12);
};

const backToApp = async (): Promise<void> => {
  await click(screen.getByRole('button', { name: /^Back to app/ }));
  await settle(8);
};

const studio = (): string | null => useAppStore.getState().appStudio?.kind ?? null;

const lensOf = (): string | null => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  return sessionId === null ? 'board' : (state.activeLens[sessionId] ?? null);
};

const currentDoors = (): ReadonlyArray<string> =>
  Array.from(
    document.querySelectorAll(
      '[data-side-column] [data-column-layer="nav"] [data-column-door][aria-current="page"], [data-column-rail] [data-column-door][aria-current="page"], [data-top-bar] [aria-current="page"]',
    ),
  ).map(
    (element) =>
      element.getAttribute('data-column-door') ?? element.getAttribute('aria-label') ?? '',
  );

const expectColumnBesideStudio = (): void => {
  const column = document.querySelector('[data-side-column], [data-column-rail]');
  expect(column).not.toBeNull();
  expect(column?.closest('aside')?.hasAttribute('inert')).toBe(false);
  expect(document.querySelector('[data-studio-slot="content"]')).not.toBeNull();
  expect(document.querySelector('[data-studio-slot="cover"]')).toBeNull();
};

const expectHealthy = (): void => {
  expect(
    consoleErrors.filter((line) =>
      ['Maximum update depth', '#185', 'getSnapshot should be cached'].some((marker) =>
        line.includes(marker),
      ),
    ),
  ).toEqual([]);
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('moving across every place keeps one frame', () => {
  it(
    'walks the board, a session and its pages, then Back and Forward retrace them',
    async () => {
      const { sessionId } = await boot({ seed: 'pr' });

      await click(door('board'));
      await heading('Board');
      expect(currentDoors()).toEqual(['board']);

      await click(historyButton('Back'));
      expect(useAppStore.getState().currentSessionId).toBe(sessionId);
      expect(currentDoors()).toEqual([]);

      await openCrumb(/^Agents/);
      expect(lensOf()).toBe('agents');
      await press('lens.workflows');
      await press('lens.plans');
      await press('lens.review');
      expect(lensOf()).toBe('branch');

      await click(historyButton('Back'));
      expect(lensOf()).toBe('plans');
      await click(historyButton('Back'));
      expect(lensOf()).toBe('workflows');
      await click(historyButton('Forward'));
      expect(lensOf()).toBe('plans');
      expect(document.querySelector('[data-side-column]')).not.toBeNull();
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'opens every studio beside the column from a session page and lands back on that page',
    async () => {
      await boot({ seed: 'pr' });
      await openCrumb(/^Agents/);

      const doors: ReadonlyArray<readonly [() => HTMLElement, string]> = [
        [() => door('inbox'), 'inbox'],
        [() => door('chat'), 'chat'],
        [() => door('workflows'), 'workflow'],
        [() => screen.getByRole('button', { name: 'Impact' }), 'impact'],
      ];
      for (const [control, kind] of doors) {
        await click(control());
        expect(studio()).toBe(kind);
        expectColumnBesideStudio();
        await escape();
        expect(studio()).toBeNull();
        expect(lensOf()).toBe('agents');
      }

      await openPalette(/^Notifications$/, 'Notifications');
      expect(studio()).toBe('notifications');
      expectColumnBesideStudio();
      expect(currentDoors()).toEqual([]);
      await escape();
      expect(lensOf()).toBe('agents');
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'swaps the column for Settings, and Back to app, Esc and Back all land on the same page',
    async () => {
      await boot({ seed: 'pr' });
      await openCrumb(/^Agents/);

      const exits: ReadonlyArray<() => Promise<void>> = [
        backToApp,
        escape,
        () => click(historyButton('Back')),
      ];
      for (const exit of exits) {
        await click(door('settings'));
        expect(studio()).toBe('settings');
        expect(screen.getByRole('navigation', { name: 'Settings scopes' })).toBeDefined();
        expect(document.querySelector('[data-column-layer="nav"]')?.hasAttribute('inert')).toBe(
          true,
        );

        await exit();

        expect(studio()).toBeNull();
        expect(lensOf()).toBe('agents');
        expect(document.querySelector('[data-column-layer="nav"]')?.hasAttribute('inert')).toBe(
          false,
        );
      }
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'finds a setting from the column search and opens its page in place',
    async () => {
      await boot({ seed: 'pr' });
      await click(door('settings'));
      const entriesBefore =
        useAppStore.getState().navigation[useAppStore.getState().currentWorkspaceId ?? '']?.entries
          .length;

      fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), {
        target: { value: 'storage' },
      });
      await settle();
      const results = screen.getByRole('list', { name: 'Matching settings' });
      await click(within(results).getAllByRole('button')[0] as HTMLElement);

      const focus = useAppStore.getState().appStudio;
      expect(focus?.kind).toBe('settings');
      expect(focus?.kind === 'settings' ? focus.focus.section : null).toBe('storage');
      expect(
        useAppStore.getState().navigation[useAppStore.getState().currentWorkspaceId ?? '']?.entries
          .length,
      ).toBe(entriesBefore);

      fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), {
        target: { value: 'zzzz nothing' },
      });
      await settle();
      expect(screen.getByText('No settings match')).toBeDefined();
    },
    JOURNEY_MS,
  );

  it(
    'folds into the rail of doors with ⌘B on the board, in a session, under a studio and under Settings',
    async () => {
      await boot({ seed: 'pr' });

      await press('column.toggle');
      expect(document.querySelector('[data-column-rail]')).not.toBeNull();
      expect(document.querySelector('[data-side-column]')).toBeNull();

      await click(door('inbox'));
      expect(studio()).toBe('inbox');
      expect(currentDoors()).toEqual(['inbox']);

      await click(door('settings'));
      expect(studio()).toBe('settings');
      expect(screen.getByRole('navigation', { name: 'Settings scopes' })).toBeDefined();

      await press('column.toggle');
      expect(document.querySelector('[data-side-column]')).not.toBeNull();
      expect(screen.getByRole('button', { name: /^Back to app/ })).toBeDefined();

      await backToApp();
      await click(door('board'));
      await heading('Board');
      await press('column.toggle');
      expect(door('board').getAttribute('aria-current')).toBe('page');
      await press('column.toggle');
      expect(door('board').getAttribute('aria-current')).toBe('page');
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'keeps a drawer with its page while a studio sits over it',
    async () => {
      const { sessionId } = await boot({ seed: 'pr' });

      await press('lens.context');
      await waitFor(
        () => expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('context'),
        WAIT,
      );

      await click(door('inbox'));
      expect(studio()).toBe('inbox');
      await escape();

      expect(studio()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBe(sessionId);
      expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('context');
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'lands palette destinations in the frame and marks their door',
    async () => {
      await boot({ seed: 'pr' });

      await openPalette(/^Inbox$/, 'Inbox');
      expect(studio()).toBe('inbox');
      expect(currentDoors()).toEqual(['inbox']);
      expectColumnBesideStudio();

      await openPalette(/^Board/, 'Back to board');
      expect(studio()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBeNull();
      expect(currentDoors()).toEqual(['board']);

      await clickButton('New session');
      expect(currentDoors()).toEqual(['new']);
      expectHealthy();
    },
    JOURNEY_MS,
  );
});
