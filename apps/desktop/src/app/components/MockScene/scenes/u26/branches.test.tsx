// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26_BRANCHES_SCENES } from './branches';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U26_BRANCHES_SCENES;

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

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U26_BRANCHES_SCENES[name];
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

const rows = (): ReadonlyArray<HTMLElement> =>
  screen.getAllByRole('option').filter((option) => option.hasAttribute('data-select-id'));

describe('the u26 branches scenes, units 1 and 2', () => {
  it('registers every scene in the mock registry, in both themes', () => {
    const names = Object.keys(U26_BRANCHES_SCENES);
    for (const name of names) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
    expect(names.filter((name) => name.endsWith('-dark'))).toHaveLength(4);
    expect(names.filter((name) => name.endsWith('-light'))).toHaveLength(4);
  });

  it.each(['u26-sessions-base-dark', 'u26-sessions-base-light'] as const)(
    '%s draws the main sidebar rows as title, space, state, with no checkbox and no hint',
    async (name) => {
      await mount({ name });

      expect(screen.queryByRole('checkbox')).toBeNull();
      const [first] = rows();
      expect(first?.lastElementChild?.hasAttribute('data-row-state')).toBe(true);
      expect(first?.getAttribute('aria-selected')).toBe('false');
      expect(screen.queryByText('Shift click for a range, Option click to add one')).toBeNull();
    },
  );

  it.each(['u26-sessions-multi-dark', 'u26-sessions-multi-light'] as const)(
    '%s shows three rows selected with no checkbox and the bar counting them',
    async (name) => {
      await mount({ name });

      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(rows().filter((row) => row.getAttribute('aria-selected') === 'true')).toHaveLength(3);
      expect(within(screen.getByRole('toolbar')).getByText('3 selected')).toBeDefined();
      expect(screen.getByText('Shift click for a range, Option click to add one')).toBeDefined();
    },
  );

  it.each(['u26-board-multi-dark', 'u26-board-multi-light'] as const)(
    '%s shows three cards pressed with no checkbox, the track and padding at rest',
    async (name) => {
      await mount({ name });

      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3);
      expect(within(screen.getByRole('toolbar')).getByText('3 selected')).toBeDefined();
    },
  );

  it.each(['u26-cards-inset-dark', 'u26-cards-inset-light'] as const)(
    '%s draws the Projects and Linked cards through one component',
    async (name) => {
      await mount({ name });

      const projects = screen.getByRole('group', { name: 'Projects' });
      const linked = screen.getByRole('group', { name: 'Linked' });
      expect(projects.getAttribute('data-level-card')).toBe('Projects');
      expect(linked.getAttribute('data-level-card')).toBe('Linked');
    },
  );
});
