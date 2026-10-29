// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  FIX_RUN_MOUNT,
  MOUNT_TARGET,
  SESSION,
  seedResolveScene,
} from '../../../app/components/MockScene/scenes/resolveSeed';
import type { WorktreeDepsCheck } from '../../lib/worktreeDepsCheck';
import { StaleDepsAction } from '../StaleDepsAction';
import { StaleDepsNotice } from './index';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const MISSING: WorktreeDepsCheck = {
  state: 'missing',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: false,
  outside: [],
};

const READY: WorktreeDepsCheck = { ...MISSING, state: 'ready' };

const LINKED: WorktreeDepsCheck = {
  ...MISSING,
  state: 'outside',
  isFolderLink: true,
  outside: ['node_modules'],
};

type Plan = {
  readonly checks: ReadonlyArray<WorktreeDepsCheck>;
};

const world = { isInstalled: false };

const planChecks = ({ checks }: Plan) => {
  const before = checks[0] ?? READY;
  const after = checks[1] ?? before;
  const unlink = vi.fn(async () => ['node_modules']);
  stubStoryInvoke({
    worktree_deps_check: () => (world.isInstalled ? after : before),
    worktree_deps_unlink: () => unlink(),
  });
  return { unlink };
};

type InstallResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const stubInstall = (result: InstallResult) => {
  const runDiscoveredScript = vi.fn(async () => {
    world.isInstalled = result.exitCode === 0;
    return result;
  });
  store.setState({ runDiscoveredScript });
  return runDiscoveredScript;
};

beforeEach(async () => {
  world.isInstalled = false;
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
  store.setState({ sessionProjectMounts: { [SESSION.id]: [FIX_RUN_MOUNT] } });
});

afterEach(cleanup);

const notice = (onInstalled?: () => void) => (
  <StaleDepsNotice
    sessionId={SESSION.id}
    mountId={MOUNT_TARGET.mountId}
    {...(onInstalled !== undefined && { onInstalled })}
  />
);

describe('StaleDepsNotice', () => {
  it('says nothing when the worktree has its dependencies', async () => {
    planChecks({ checks: [READY] });
    const { container } = render(notice());

    await waitFor(() =>
      expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_deps_check', expect.anything()),
    );
    expect(container.textContent).toBe('');
  });

  it('checks the worktree of that branch and offers the reinstall when dependencies are missing', async () => {
    planChecks({ checks: [MISSING] });
    render(notice());

    await screen.findByText('Dependencies are not installed in this worktree');
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('worktree_deps_check', {
      repoPath: FIX_RUN_MOUNT.repoRoot,
      worktreePath: FIX_RUN_MOUNT.worktreePath,
    });
    screen.getByRole('button', { name: 'Reinstall dependencies' });
  });

  it('installs in that worktree, then retries what was waiting and checks again', async () => {
    planChecks({ checks: [MISSING, READY] });
    const runDiscoveredScript = stubInstall({ stdout: '', stderr: '', exitCode: 0 });
    const onInstalled = vi.fn();
    render(notice(onInstalled));

    fireEvent.click(await screen.findByRole('button', { name: 'Reinstall dependencies' }));

    await waitFor(() => expect(onInstalled).toHaveBeenCalledOnce());
    expect(runDiscoveredScript).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION.id,
        mountId: MOUNT_TARGET.mountId,
        command: 'pnpm install --frozen-lockfile',
        cwd: FIX_RUN_MOUNT.worktreePath,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Dependencies are not installed in this worktree')).toBeNull(),
    );
  });

  it('shows the progress of the install and what went wrong when it fails', async () => {
    planChecks({ checks: [MISSING] });
    stubInstall({
      stdout: '',
      stderr: 'ERR_PNPM_NO_MATCHING_VERSION no version for vitest',
      exitCode: 1,
    });
    const onInstalled = vi.fn();
    render(notice(onInstalled));

    fireEvent.click(await screen.findByRole('button', { name: 'Reinstall dependencies' }));

    await screen.findByText("Couldn't install: ERR_PNPM_NO_MATCHING_VERSION no version for vitest");
    expect(onInstalled).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Reinstall dependencies' });
  });

  it('shows the running install when the card comes back while it runs', async () => {
    planChecks({ checks: [MISSING] });
    const scriptId = `deps-install:${MOUNT_TARGET.mountId}`;
    store.setState({
      scriptRuns: {
        [SESSION.id]: {
          [scriptId]: {
            status: 'pending',
            result: null,
            runId: 'run-1',
            startedAt: 1,
            output: 'Progress: resolved 120\nProgress: resolved 480\n',
          },
        },
      },
    });
    const first = render(notice());
    await screen.findByText('Installing dependencies: Progress: resolved 480');
    first.unmount();
    render(notice());

    await screen.findByText('Installing dependencies: Progress: resolved 480');
    expect(screen.queryByRole('button', { name: 'Reinstall dependencies' })).toBeNull();
  });

  it('removes only the link before it installs when the folder points at another checkout', async () => {
    const { unlink } = planChecks({ checks: [LINKED, READY] });
    const runDiscoveredScript = stubInstall({ stdout: '', stderr: '', exitCode: 0 });
    render(notice());

    await screen.findByText('This worktree reads dependencies from another folder');
    screen.getByText(/removes only the link, never the folder it points to/);
    fireEvent.click(screen.getByRole('button', { name: 'Reinstall dependencies' }));

    await waitFor(() => expect(runDiscoveredScript).toHaveBeenCalledOnce());
    expect(unlink).toHaveBeenCalledOnce();
    expect(unlink.mock.invocationCallOrder[0]).toBeLessThan(
      runDiscoveredScript.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

describe('StaleDepsAction', () => {
  it('stays hidden while the worktree is ready', async () => {
    planChecks({ checks: [READY] });
    const { container } = render(
      <StaleDepsAction sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} />,
    );

    await act(async () => undefined);
    expect(container.textContent).toBe('');
  });

  it('offers the reinstall beside a failed push and hands the retry to the caller after it', async () => {
    planChecks({ checks: [MISSING, READY] });
    stubInstall({ stdout: '', stderr: '', exitCode: 0 });
    const onInstalled = vi.fn();
    render(
      <StaleDepsAction
        sessionId={SESSION.id}
        mountId={MOUNT_TARGET.mountId}
        onInstalled={onInstalled}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Reinstall dependencies' }));

    await waitFor(() => expect(onInstalled).toHaveBeenCalledOnce());
    await screen.findByText('Dependencies are installed.');
  });

  it('is offered even on a ready worktree when the caller knows the checks were skipped for it', async () => {
    planChecks({ checks: [READY] });
    render(<StaleDepsAction sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} isForced />);

    screen.getByRole('button', { name: 'Reinstall dependencies' });
  });
});
