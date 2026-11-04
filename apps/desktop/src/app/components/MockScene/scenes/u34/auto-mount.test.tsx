// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type MountId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { AUTO_SESSION } from '../u24/autoSceneSeed';
import { U34_AUTO_MOUNT_SCENES } from './auto-mount';

const WAIT = { timeout: 15_000 };

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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
  localStorage.clear();
});

const mount = ({ id }: { readonly id: string }): void => {
  const Scene = U34_AUTO_MOUNT_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the mount card scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U34_AUTO_MOUNT_SCENES).sort()).toEqual([
      'u34-p21-mount-ask',
      'u34-p21-mount-done',
      'u34-p21-mount-failed',
      'u34-p21-mount-mounting',
    ]);
    for (const [id, Scene] of Object.entries(U34_AUTO_MOUNT_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('u34-p21-mount-ask names the need, the branch and one primary button', async () => {
    mount({ id: 'u34-p21-mount-ask' });

    expect(await screen.findByText('To do this, add notify-relay', undefined, WAIT)).toBeDefined();
    expect(
      await screen.findByText('A worktree on ak/feat-new-explore is created from main.'),
    ).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Add notify-relay' })).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Another folder…' })).toBeDefined();
    expect(await screen.findByRole('button', { name: 'No folder, just answer' })).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull();
  });

  it('adds the named project on the named branch, then answers Auto so it goes on', async () => {
    mount({ id: 'u34-p21-mount-ask' });
    await screen.findByText('To do this, add notify-relay', undefined, WAIT);
    const ensured: Array<unknown> = [];
    const sent: Array<unknown> = [];
    await screen.findByText('The worktree needs notify-relay added first.', undefined, WAIT);
    await act(async () => {
      store.setState({
        ensureProjectMounted: async (input) => {
          ensured.push(input);
          const mountId = brandId<MountId>({ value: 'mount-new' });
          return { status: 'created', createdMountId: mountId, mountIds: [mountId] };
        },
        sendTurn: async (input) => {
          sent.push(input);
          return { blockedOverBudget: false };
        },
      });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add notify-relay' }));
    await waitFor(() => expect(ensured).toHaveLength(1), WAIT);

    expect(
      await screen.findByText('Added notify-relay on ak/feat-new-explore', undefined, WAIT),
    ).toBeDefined();
    expect(ensured).toMatchObject([
      { branch: 'ak/feat-new-explore', reason: 'The user asked for a worktree on this branch.' },
    ]);
    expect(sent).toMatchObject([
      { content: 'Added notify-relay on ak/feat-new-explore. Go on with my request.' },
    ]);
  });

  it('keeps the card with a conflict when another window added the project on a different branch', async () => {
    mount({ id: 'u34-p21-mount-ask' });
    await screen.findByText('To do this, add notify-relay', undefined, WAIT);
    const sent: Array<unknown> = [];
    const project = store
      .getState()
      .projects.find((candidate) => candidate.name === 'notify-relay');
    if (project === undefined) {
      throw new Error('the scene has no notify-relay');
    }
    await act(async () => {
      store.setState({
        ensureProjectMounted: async () => {
          const mountId = brandId<MountId>({ value: 'mount-other-window' });
          store.setState((state) => ({
            sessionProjectMounts: {
              ...state.sessionProjectMounts,
              [AUTO_SESSION.id]: [
                {
                  mountId,
                  sessionId: AUTO_SESSION.id,
                  projectId: project.id,
                  mountName: 'notify-relay',
                  worktreePath: '/work/harborline/notify-relay/.goodboy/worktrees/other',
                  lastWorktreePath: '/work/harborline/notify-relay/.goodboy/worktrees/other',
                  repoRoot: project.rootPath,
                  branch: 'ak/other-window',
                  baseBranch: null,
                  parallelIndex: 1,
                  isAttached: true,
                  diskState: 'present',
                  revision: 0,
                },
              ],
            },
          }));
          return { status: 'already-mounted', mountIds: [mountId] };
        },
        sendTurn: async (input) => {
          sent.push(input);
          return { blockedOverBudget: false };
        },
      });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add notify-relay' }));

    expect(
      await screen.findByText(
        'notify-relay is already added on branch ak/other-window, not on ak/feat-new-explore.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(sent).toEqual([]);
    expect(screen.queryByText('Added notify-relay on ak/feat-new-explore')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Add notify-relay' })).toBeDefined();
  });

  it('u34-p21-mount-mounting says what is happening on the button', async () => {
    mount({ id: 'u34-p21-mount-mounting' });

    expect(await screen.findByText('Adding notify-relay', undefined, WAIT)).toBeDefined();
  });

  it('u34-p21-mount-failed keeps the card with the reason', async () => {
    mount({ id: 'u34-p21-mount-failed' });

    expect(
      await screen.findByText(/already used by another worktree/, undefined, WAIT),
    ).toBeDefined();
    expect(await screen.findByText('To do this, add notify-relay')).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Add notify-relay' })).toBeDefined();
  });

  it('u34-p21-mount-done shows one line and no card', async () => {
    mount({ id: 'u34-p21-mount-done' });

    expect(
      await screen.findByText('Added notify-relay on ak/feat-new-explore', undefined, WAIT),
    ).toBeDefined();
    expect(screen.queryByText('To do this, add notify-relay')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add notify-relay' })).toBeNull();
  });
});
