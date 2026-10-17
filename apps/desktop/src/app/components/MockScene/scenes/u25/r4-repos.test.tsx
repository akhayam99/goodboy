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
import { U25_R4_REPOS_SCENES } from './r4-repos';

const SETTLE_MS = 2_000;

const NAMES = [
  'r4-repos-behind',
  'r4-repos-closed',
  'r4-repos-dirty',
  'r4-repos-failed',
  'r4-repos-quiet',
] as const;

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
  const Scene = U25_R4_REPOS_SCENES[name];
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

const entry = (): HTMLElement => screen.getByRole('button', { name: /^Repositories/ });

const rowOf = (name: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-repo-row="${name}"]`);
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

describe('the repositories entry scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_R4_REPOS_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_R4_REPOS_SCENES[name]);
    }
  });

  it('r4-repos-behind sits next to the workspace switcher with Pull all and per repo Pull', async () => {
    await mount('r4-repos-behind');

    const topBar = document.querySelector<HTMLElement>('[data-top-bar]');
    expect(
      topBar === null ? null : within(topBar).getByRole('button', { name: /^Repositories/ }),
    ).not.toBeNull();
    expect(entry().textContent).toBe('2 repos behind · Diverged');
    const dialog = screen.getByRole('dialog', { name: 'Repositories' });
    expect(within(dialog).getByRole('button', { name: 'Pull all' })).toBeDefined();
    expect(within(dialog).queryByText('Up to date')).toBeNull();
    expect(within(rowOf('payments-api')).getByRole('button', { name: /^Pull main/ })).toBeDefined();
    expect(within(rowOf('notify-relay')).queryByRole('button', { name: /^Pull/ })).toBeNull();
    expect(within(rowOf('ledger-core')).getByText(/your checkout stays on/)).toBeDefined();
  });

  it('r4-repos-dirty explains the dirty checkout instead of a Pull', async () => {
    await mount('r4-repos-dirty');
    expect(within(rowOf('payments-api')).queryByRole('button', { name: /^Pull/ })).toBeNull();
    expect(within(rowOf('payments-api')).getByText(/Commit or stash them first/)).toBeDefined();
  });

  it('r4-repos-failed shows a quiet failure with Retry', async () => {
    await mount('r4-repos-failed');
    expect(entry().textContent).toBe('Check failed');
    expect(
      within(rowOf('payments-api')).getByRole('button', {
        name: 'Retry the check of payments-api',
      }),
    ).toBeDefined();
  });

  it('r4-repos-quiet leaves the entry as an icon', async () => {
    await mount('r4-repos-quiet');
    expect(entry().textContent).toBe('');
    expect(screen.queryByRole('dialog', { name: 'Repositories' })).toBeNull();
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
