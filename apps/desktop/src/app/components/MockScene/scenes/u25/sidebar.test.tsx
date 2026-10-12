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
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_SIDEBAR_SCENES } from './sidebar';

const SETTLE_MS = 2_000;

const NAMES = ['sidebar-rhythm', 'sidebar-meta-branch', 'sidebar-meta-branches'] as const;

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

const mount = async (name: SceneName): Promise<Element> => {
  const Scene = U25_SIDEBAR_SCENES[name];
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const pages = () => within(screen.getByRole('list', { name: 'Pages' }));

describe('the sidebar scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_SIDEBAR_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_SIDEBAR_SCENES[name]);
    }
  });

  it('sidebar-rhythm has one separator, doors with a plus, and New session under Sessions', async () => {
    await mount('sidebar-rhythm');

    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'New chat' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New terminal' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'New session' })).toHaveLength(1);
    expect(document.querySelector('[data-column-create]')).toBeNull();
  });

  it('sidebar-meta-branch names the branch of the one mount', async () => {
    await mount('sidebar-meta-branch');

    expect(pages().getByRole('button', { name: /^Branch/ }).textContent).toBe(
      'Branchharborline/webhook-retries',
    );
  });

  it('sidebar-meta-branches counts the branches', async () => {
    await mount('sidebar-meta-branches');

    expect(pages().getByRole('button', { name: /^Branch/ }).textContent).toBe('Branch3 branches');
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
