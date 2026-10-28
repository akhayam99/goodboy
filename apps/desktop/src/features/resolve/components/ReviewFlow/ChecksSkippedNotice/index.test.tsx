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
import { ChecksSkippedNotice } from './index';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const READY = {
  state: 'ready',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: false,
  outside: [],
};

type Check = { readonly state: string };

const world: { check: Check } = { check: { ...READY, state: 'missing' } };

beforeEach(async () => {
  world.check = { ...READY, state: 'missing' };
  await resetStoryStore();
  stubStoryInvoke({ worktree_deps_check: () => world.check });
  seedResolveScene({ expandedThreadId: null });
  store.setState({ sessionProjectMounts: { [SESSION.id]: [FIX_RUN_MOUNT] } });
});

afterEach(cleanup);

const SKIPPED =
  "Committed as `90b1d57f1`. eslint and tsc didn't run because deps aren't installed in this copy, so the change is checked only by prettier.";

describe('ChecksSkippedNotice', () => {
  it('shows the warning and offers to reinstall the dependencies of that branch', async () => {
    store.setState({
      runDiscoveredScript: vi.fn(async () => {
        world.check = { ...READY };
        return { stdout: '', stderr: '', exitCode: 0 };
      }),
    });
    render(
      <ChecksSkippedNotice text={SKIPPED} sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} />,
    );

    screen.getByText("Checks were skipped: deps aren't installed in this copy");
    fireEvent.click(await screen.findByRole('button', { name: 'Reinstall dependencies' }));

    await screen.findByText('Dependencies are installed.');
  });

  it('offers the reinstall for a skip that names dependencies even when the worktree looks ready', async () => {
    world.check = { ...READY };
    render(
      <ChecksSkippedNotice text={SKIPPED} sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} />,
    );

    screen.getByRole('button', { name: 'Reinstall dependencies' });
  });

  it('offers nothing for a skip that has another cause on a ready worktree', async () => {
    world.check = { ...READY };
    render(
      <ChecksSkippedNotice
        text="The tests didn't run because the runner timed out."
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
      />,
    );

    screen.getByText('Checks were skipped: the runner timed out');
    await waitFor(() => expect(storySpies.tauriInvoke).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Reinstall dependencies' })).toBeNull();
  });

  it('offers the reinstall when the worktree check finds a problem the reason does not name', async () => {
    render(
      <ChecksSkippedNotice
        text="The tests didn't run because the runner timed out."
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
      />,
    );

    await screen.findByRole('button', { name: 'Reinstall dependencies' });
  });

  it('shows only the warning without a branch to reinstall in', () => {
    render(<ChecksSkippedNotice text={SKIPPED} />);

    screen.getByText("Checks were skipped: deps aren't installed in this copy");
    expect(screen.queryByRole('button', { name: 'Reinstall dependencies' })).toBeNull();
  });

  it('renders nothing when the agent skipped no check', () => {
    const { container } = render(
      <ChecksSkippedNotice
        text="I ran eslint and tsc, both pass."
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
      />,
    );

    expect(container.textContent).toBe('');
  });
});
