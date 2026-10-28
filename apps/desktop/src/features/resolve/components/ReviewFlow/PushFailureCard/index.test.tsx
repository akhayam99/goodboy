// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  FIX_RUN_MOUNT,
  MOUNT_TARGET,
  SESSION,
  seedResolveScene,
} from '../../../../../app/components/MockScene/scenes/resolveSeed';
import { PushFailureCard } from './index';
import type { ReviewPush } from '../useReviewPush';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const MISSING = {
  state: 'missing',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: false,
  outside: [],
};

type WorldState = 'missing' | 'ready';

const world: { isInstalled: boolean; state: WorldState } = {
  isInstalled: false,
  state: 'missing',
};

beforeEach(async () => {
  world.isInstalled = false;
  world.state = 'missing';
  await resetStoryStore();
  stubStoryInvoke({
    worktree_deps_check: () =>
      world.isInstalled || world.state === 'ready' ? { ...MISSING, state: 'ready' } : MISSING,
  });
  seedResolveScene({ expandedThreadId: null });
  store.setState({
    sessionProjectMounts: { [SESSION.id]: [FIX_RUN_MOUNT] },
    runDiscoveredScript: vi.fn(async () => {
      world.isInstalled = true;
      return { stdout: '', stderr: '', exitCode: 0 };
    }),
  });
});

afterEach(cleanup);

const push = (overrides: Partial<ReviewPush>): ReviewPush => ({
  phase: { kind: 'idle' },
  fixTarget: { mountId: MOUNT_TARGET.mountId },
  retryAfterFix: vi.fn(async () => undefined),
  retryAfterDeps: vi.fn(),
  arm: vi.fn(async () => undefined),
  press: vi.fn(async () => undefined),
  confirm: vi.fn(async () => undefined),
  cancel: vi.fn(),
  askSync: vi.fn(),
  confirmSync: vi.fn(async () => undefined),
  dismiss: vi.fn(),
  recover: vi.fn(),
  ...overrides,
});

const OUTPUT = '$ yarn typecheck\nhusky - pre-push script failed (code 1)';

const result = {
  tone: 'failed' as const,
  sentence: 'Nothing was pushed.',
  failure: { output: OUTPUT },
};

describe('PushFailureCard with stale dependencies', () => {
  it('offers to reinstall and retries the push once the install worked', async () => {
    const retryAfterDeps = vi.fn();
    render(
      <PushFailureCard sessionId={SESSION.id} push={push({ retryAfterDeps })} result={result} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Reinstall dependencies' }));

    await waitFor(() => expect(retryAfterDeps).toHaveBeenCalledOnce());
    screen.getByRole('button', { name: 'Let an agent fix the push' });
  });

  it('does not offer it when the dependencies are in place', async () => {
    world.state = 'ready';
    render(<PushFailureCard sessionId={SESSION.id} push={push({})} result={result} />);

    await waitFor(() => expect(storySpies.tauriInvoke).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Reinstall dependencies' })).toBeNull();
    screen.getByRole('button', { name: 'Let an agent fix the push' });
  });
});
