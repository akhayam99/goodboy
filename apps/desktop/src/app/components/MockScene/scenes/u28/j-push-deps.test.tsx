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

  it('turns the push failed card into the card of the fix while the agent works', async () => {
    show({ name: 'push-fix-working' });

    const line = await screen.findByRole('status');
    within(line).getByText('Fixing');
    within(line).getByText('Running pnpm typecheck');
    screen.getByText('Push failed');
    screen.getByRole('button', { name: 'Stop' });
    screen.getByRole('button', { name: 'Open transcript' });
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fix with an agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open the agent' })).toBeNull();
  });

  it('shows a pushed fix and the pull request it opened', async () => {
    show({ name: 'push-fix-pushed' });

    const line = await screen.findByRole('status');
    within(line).getByText('Pushed');
    within(line).getByText('Pull request #318 is open.');
  });

  it('shows why the agent failed on the push card, with one Retry', async () => {
    show({ name: 'push-fix-agent-failed' });

    await screen.findByText('The agent was stopped before it finished.');
    screen.getByText('Failed');
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    screen.getByRole('button', { name: 'Open transcript' });
    screen.getByRole('button', { name: 'Open terminal here' });
  });

  it('says what stays on the branch after you stopped the fix', async () => {
    show({ name: 'push-fix-stopped' });

    await screen.findByText('Nothing was pushed; its edits stay on the branch.');
    screen.getByText('Stopped');
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
  });

  it('shows which check stopped the push after the fix', async () => {
    show({ name: 'push-fix-push-failed' });

    within(await screen.findByRole('alert')).getByText(
      "The fix couldn't be pushed: pre-push: pnpm knip failed.",
    );
  });

  it('warns that the worktree reads dependencies from another folder and offers the reinstall once, on its own notice', async () => {
    show({ name: 'push-stale-deps-linked' });

    await screen.findByText('This worktree reads dependencies from another folder');
    const alert = await screen.findByRole('alert');
    expect(within(alert).queryByRole('button', { name: 'Reinstall dependencies' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Reinstall dependencies' })).toHaveLength(1);
    within(alert).getByRole('button', { name: 'Fix with an agent' });
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
