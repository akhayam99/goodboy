// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U24_RAILS_SCENES } from './rails';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localStorage.clear();
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = ({ name }: { readonly name: string }): Element => {
  const Scene = U24_RAILS_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  ).container;
};

describe('the rail scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_RAILS_SCENES).sort()).toEqual([
      'notifications-rail',
      'tasks-rail',
      'tasks-rail-folded',
      'tasks-rail-open',
    ]);
    expect(MOCK_SCENES['tasks-rail']).toBe(U24_RAILS_SCENES['tasks-rail']);
    expect(MOCK_SCENES['notifications-rail']).toBe(U24_RAILS_SCENES['notifications-rail']);
  });

  it('tasks-rail docks the facets and the search beside the list', async () => {
    mount({ name: 'tasks-rail' });

    const rail = await screen.findByRole('complementary', { name: 'Task filters' }, WAIT);
    expect(within(rail).getByRole('navigation', { name: 'Filter tasks' })).toBeDefined();
    expect(within(rail).getByRole('searchbox', { name: 'Search tasks' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
  });

  it('tasks-rail-open keeps the rail while a record is open in the drawer', async () => {
    mount({ name: 'tasks-rail-open' });

    await screen.findByRole('complementary', { name: 'Task filters' }, WAIT);
    const drawer = screen.getByRole('complementary', { name: 'Task' });
    expect(drawer.getAttribute('data-drawer-mode')).not.toBe('closed');
  });

  it('tasks-rail-folded shows the Filters button and no rail', async () => {
    mount({ name: 'tasks-rail-folded' });

    await screen.findByRole('button', { name: 'Filters' }, WAIT);
    expect(screen.queryByRole('complementary', { name: 'Task filters' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dock the filters' })).toBeDefined();
  });

  it('notifications-rail docks View, Severity, Source and the workspace scope', async () => {
    mount({ name: 'notifications-rail' });

    const rail = await screen.findByRole('complementary', { name: 'Notification filters' }, WAIT);
    expect(within(rail).getByRole('group', { name: 'View' })).toBeDefined();
    expect(within(rail).getByRole('group', { name: 'Severity' })).toBeDefined();
    expect(within(rail).getByRole('group', { name: 'Source' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
  });

  it.each(['tasks-rail', 'tasks-rail-folded'])(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = mount({ name });
      await screen.findByRole('searchbox', { name: 'Search tasks' }, WAIT);

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
