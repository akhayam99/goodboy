// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { useAppStore } from '../../../../../store';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_CENTRAL_SCENES } from './central';

const KINDS = ['mid', 'finished', 'stuck', 'blocked', 'orchestrated', 'agent', 'branches'] as const;

const KEYS = [
  ...KINDS.flatMap((kind) => [`u26-central-${kind}-light`, `u26-central-${kind}-dark`]),
  'u26-central-log-light',
  'u26-central-log-dark',
  'u26-central-log-search-light',
];

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };

const show = async ({ name }: Params) => {
  const Scene = U26_CENTRAL_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown central scene');
  }
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

describe('the central column scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U26_CENTRAL_SCENES)).toEqual(KEYS);
  });

  it('draws the Log drawer over the column', async () => {
    await show({ name: 'u26-central-log-light' });

    screen.getByRole('region', { name: 'Log' });
    screen.getByRole('region', { name: 'Running' });
  });

  it('opens the log drawer on the search scene', async () => {
    await show({ name: 'u26-central-log-search-light' });

    screen.getByRole('region', { name: 'Log' });
    screen.getByRole('searchbox', { name: 'Search the log' });
  });

  it('draws the Needs you, Running and Done cards on the mid scene, the run gate on its row', async () => {
    await show({ name: 'u26-central-mid-light' });

    for (const name of ['Needs you', 'Running', 'Done']) {
      screen.getByRole('region', { name });
    }
    expect(screen.queryByRole('region', { name: 'Now' })).toBeNull();
  });

  it('draws the stuck Auto as one block on the blocked scene, Needs you said once', async () => {
    await show({ name: 'u26-central-blocked-light' });

    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    expect(needsYou.querySelector('[data-now-sentence]')).toBeNull();
    expect(needsYou.querySelector('[data-live-group="auto"]')).toBeNull();
    expect(needsYou.querySelector('[data-now-actions]')).toBeNull();
    expect(needsYou.textContent).not.toContain('Stuck');
    expect(needsYou.textContent).not.toContain('Deciding');
    expect(needsYou.textContent).not.toContain('declared_blocked');
    expect(screen.queryByRole('region', { name: 'Running' })).toBeNull();
    const inCard = within(needsYou);
    inCard.getByRole('button', { name: 'Open Auto' });
    expect(inCard.queryByRole('button', { name: 'Answer Auto in its chat' })).toBeNull();
    inCard.getByRole('button', { name: 'Stop Auto and its agents' });
    inCard.getByRole('button', { name: 'Retry "Fix the two doc mismatches in ledger-core"' });
  });

  it('settles when the stale branch detail read fails on the branches scene', async () => {
    const startedAt = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(startedAt);
    try {
      await show({ name: 'u26-central-branches-light' });
      const detailReads = () =>
        storySpies.tauriInvoke.mock.calls.filter(
          ([command, args]) => command === 'gh_run' && JSON.stringify(args).includes('/comments'),
        ).length;
      const before = detailReads();
      vi.setSystemTime(startedAt + 31_000);
      for (let poll = 0; poll < 5; poll += 1) {
        act(() => {
          useAppStore.setState((state) => ({
            mountGithub: Object.fromEntries(
              Object.entries(state.mountGithub).map(([mountId, github]) => [
                mountId,
                {
                  ...github,
                  fetchedAt: brandId<IsoDateTime>({
                    value: new Date(Date.now() + poll).toISOString(),
                  }),
                },
              ]),
            ),
          }));
        });
        await act(async () => {
          for (let tick = 0; tick < 20; tick += 1) {
            await Promise.resolve();
          }
        });
      }

      expect(detailReads() - before).toBe(1);
      expect(document.querySelector('[data-overview-card="branches"]')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(KEYS)('%s has no accessibility violations', async (name) => {
    const { container } = await show({ name });
    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
