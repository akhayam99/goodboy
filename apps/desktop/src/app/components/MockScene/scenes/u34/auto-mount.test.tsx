// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type MountId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U34_AUTO_MOUNT_SCENES } from './auto-mount';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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

    expect(
      await screen.findByText('To do this, mount notify-relay', undefined, WAIT),
    ).toBeDefined();
    expect(
      screen.getByText('A worktree on ak/feat-new-explore is created from main.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mount notify-relay' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Another folder…' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'No folder, just answer' })).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull();
  });

  it('mounts the named project on the named branch, then answers Auto so it goes on', async () => {
    const { useAppStore } = await import('../../../../../store');
    mount({ id: 'u34-p21-mount-ask' });
    await screen.findByText('To do this, mount notify-relay', undefined, WAIT);
    const ensured: Array<unknown> = [];
    const sent: Array<unknown> = [];
    useAppStore.setState({
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

    await new Promise((resolve) => setTimeout(resolve, 300));
    fireEvent.click(screen.getByRole('button', { name: 'Mount notify-relay' }));

    expect(
      await screen.findByText('Mounted notify-relay on ak/feat-new-explore', undefined, WAIT),
    ).toBeDefined();
    expect(ensured).toMatchObject([
      { branch: 'ak/feat-new-explore', reason: 'The user asked for a worktree on this branch.' },
    ]);
    expect(sent).toMatchObject([
      { content: 'Mounted notify-relay on ak/feat-new-explore. Go on with my request.' },
    ]);
  });

  it('u34-p21-mount-mounting says what is happening on the button', async () => {
    mount({ id: 'u34-p21-mount-mounting' });

    expect(await screen.findByText('Mounting notify-relay', undefined, WAIT)).toBeDefined();
  });

  it('u34-p21-mount-failed keeps the card with the reason', async () => {
    mount({ id: 'u34-p21-mount-failed' });

    expect(
      await screen.findByText(/already used by another worktree/, undefined, WAIT),
    ).toBeDefined();
    expect(screen.getByText('To do this, mount notify-relay')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mount notify-relay' })).toBeDefined();
  });

  it('u34-p21-mount-done shows one line and no card', async () => {
    mount({ id: 'u34-p21-mount-done' });

    expect(
      await screen.findByText('Mounted notify-relay on ak/feat-new-explore', undefined, WAIT),
    ).toBeDefined();
    expect(screen.queryByText('To do this, mount notify-relay')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mount notify-relay' })).toBeNull();
  });
});
