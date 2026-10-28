// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U28_J_PUSH_DEPS_SCENES } from './j-push-deps';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type Params = { readonly name: string };

const STALE_SCENES: ReadonlySet<string> = new Set([
  'push-stale-deps-linked',
  'push-stale-deps-installing',
]);

const LINKED = {
  state: 'outside',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: true,
  outside: ['node_modules'],
};

const READY = { ...LINKED, state: 'ready', isFolderLink: false, outside: [] };

const show = ({ name }: Params) => {
  stubStoryInvoke({ worktree_deps_check: STALE_SCENES.has(name) ? LINKED : READY });
  const Scene = U28_J_PUSH_DEPS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown push scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u28 push and dependencies scenes', () => {
  it('registers every scene by name', () => {
    for (const [name, scene] of Object.entries(U28_J_PUSH_DEPS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(scene);
    }
  });

  it('shows the fix agent working on a failure line that was left and came back', async () => {
    show({ name: 'push-fix-working' });

    await screen.findByText('An agent is fixing the push');
    screen.getByRole('button', { name: 'Open the agent' });
    expect(screen.queryByRole('button', { name: 'Let an agent fix the push' })).toBeNull();
  });

  it('shows a pushed fix and the pull request it opened', async () => {
    show({ name: 'push-fix-pushed' });

    await screen.findByText("The agent's fix is pushed. Pull request #318 is open.");
  });

  it('shows why the agent did not finish', async () => {
    show({ name: 'push-fix-agent-failed' });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The agent was stopped before it finished.',
    );
  });

  it('shows which check stopped the push after the fix', async () => {
    show({ name: 'push-fix-push-failed' });

    expect((await screen.findByRole('alert')).textContent).toBe(
      "The fix couldn't be pushed: pre-push: pnpm knip failed.",
    );
  });

  it('warns that the worktree reads dependencies from another folder and offers the reinstall beside the push actions', async () => {
    show({ name: 'push-stale-deps-linked' });

    await screen.findByText('This worktree reads dependencies from another folder');
    const alert = await screen.findByRole('alert');
    within(alert).getByRole('button', { name: 'Reinstall dependencies' });
    within(alert).getByRole('button', { name: 'Let an agent fix the push' });
  });

  it('shows the install running and its last line', async () => {
    show({ name: 'push-stale-deps-installing' });

    const status = await screen.findAllByText(
      'Installing dependencies: Progress: resolved 412, reused 380, downloaded 12',
    );
    expect(status.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(U28_J_PUSH_DEPS_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      await screen.findByRole('main');
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
