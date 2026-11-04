// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type MountId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { BLOCKED_MOUNT_AGENT_ID, BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { ADD_PROJECT_OTHER_ID } from './addProjectSeed';
import { U34_ADD_PROJECT_SCENES } from './add-project';

const SCENE = 'u34-p26-add-project';
const SETTLE_MS = 2_000;
const NEW_MOUNT = brandId<MountId>({ value: 'mock-u34-p26-mount-payments-api' });

const pendingInvoke = () => new Promise<never>(() => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    turn_quiet: [],
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = async () => {
  const Scene = U34_ADD_PROJECT_SCENES[SCENE];
  if (Scene === undefined) {
    throw new Error(`no scene ${SCENE}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const block = (): HTMLElement => {
  const node = document.querySelector<HTMLElement>('[data-mount-blocked-step]');
  if (node === null) {
    throw new Error('no blocked step');
  }
  return node;
};

const openPicker = async () => {
  fireEvent.click(within(block()).getByRole('button', { name: 'Add a project' }));
  await act(async () => undefined);
  fireEvent.click(within(block()).getByRole('checkbox', { name: 'payments-api' }));
};

describe('the u34 add a project scene', () => {
  it('registers the scene once', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U34_ADD_PROJECT_SCENES[SCENE]);
  });

  it('offers Add a project when the folder is gone and no other branch is writable', async () => {
    await mount();

    const actions = within(block())
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(actions).toEqual(['Add a project']);
  });

  it('lists the projects with no attached folder in the session', async () => {
    await mount();
    await openPicker();

    const list = within(block()).getByRole('list', { name: 'Projects' });
    expect(
      within(list)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('aria-label')),
    ).toEqual(['ledger-core', 'payments-api']);
    within(block()).getByRole('button', { name: 'Add payments-api' });
  });

  it('adds the project to this session, then starts the step on it', async () => {
    await mount();
    const ensureProjectMounted = vi.fn(async () => ({
      status: 'created' as const,
      createdMountId: NEW_MOUNT,
      mountIds: [NEW_MOUNT],
    }));
    const resolveMountBlockedStep = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ ensureProjectMounted, resolveMountBlockedStep });
    });
    await openPicker();

    await act(async () => {
      fireEvent.click(within(block()).getByRole('button', { name: 'Add payments-api' }));
    });

    expect(ensureProjectMounted).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: BLOCKED_MOUNT_SESSION_ID,
        projectId: ADD_PROJECT_OTHER_ID,
      }),
    );
    expect(resolveMountBlockedStep).toHaveBeenCalledWith({
      sessionId: BLOCKED_MOUNT_SESSION_ID,
      agentId: BLOCKED_MOUNT_AGENT_ID,
      choice: { kind: 'use', mountId: NEW_MOUNT },
    });
  });

  it('keeps the block and shows the error when the add fails, then retries to success', async () => {
    await mount();
    const ensureProjectMounted = vi
      .fn()
      .mockRejectedValueOnce(new Error('The folder is not a git repository.'))
      .mockResolvedValueOnce({
        status: 'created',
        createdMountId: NEW_MOUNT,
        mountIds: [NEW_MOUNT],
      });
    const resolveMountBlockedStep = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ ensureProjectMounted, resolveMountBlockedStep });
    });
    await openPicker();

    await act(async () => {
      fireEvent.click(within(block()).getByRole('button', { name: 'Add payments-api' }));
    });

    expect(within(block()).getByRole('alert').textContent).toContain(
      'The folder is not a git repository.',
    );
    expect(resolveMountBlockedStep).not.toHaveBeenCalled();
    expect(block().textContent).toContain('Step 3 is waiting for a branch');

    await act(async () => {
      fireEvent.click(within(block()).getByRole('button', { name: 'Add payments-api' }));
    });

    expect(ensureProjectMounted).toHaveBeenCalledTimes(2);
    expect(resolveMountBlockedStep).toHaveBeenCalledOnce();
    expect(within(block()).queryByRole('alert')).toBeNull();
  });

  it('shows the error and keeps the block when starting the step fails', async () => {
    await mount();
    act(() => {
      useAppStore.setState({
        ensureProjectMounted: vi.fn(async () => ({
          status: 'created' as const,
          createdMountId: NEW_MOUNT,
          mountIds: [NEW_MOUNT],
        })),
        resolveMountBlockedStep: vi.fn(async () => {
          throw new Error('This step is not waiting for a branch anymore.');
        }),
      });
    });
    await openPicker();

    await act(async () => {
      fireEvent.click(within(block()).getByRole('button', { name: 'Add payments-api' }));
    });

    expect(within(block()).getByRole('alert').textContent).toContain(
      'This step is not waiting for a branch anymore.',
    );
    screen.getByText('Step 3 is waiting for a branch');
  });
});
