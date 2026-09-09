// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, MountBranchObservation, MountId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  invoke: vi.fn(async (): Promise<string | null> => null),
  store: { resolveMountBranchMismatch: vi.fn(async () => undefined) },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import type { MountBranchHolder } from '../../../../../store/slices/project-mounts/mountRowModel';
import { MountBranchDecision } from './MountBranchDecision';

const sessionId = 'session-1' as SessionId;
const mountId = 'mount-1' as MountId;

const observation: MountBranchObservation = {
  mountId,
  sessionId,
  state: 'mismatch',
  recordedBranch: 'ak/part-one',
  observedBranch: 'ak/part-two',
  revision: 3,
  observedAt: '2026-09-08T10:00:00.000Z' as IsoDateTime,
};

type RenderParams = {
  readonly next?: Partial<MountBranchObservation>;
  readonly holder?: MountBranchHolder | null;
};

const renderDecision = ({ next = {}, holder = null }: RenderParams = {}) =>
  render(
    <MountBranchDecision
      sessionId={sessionId}
      mountId={mountId}
      mountLabel="ledger-core on ak/part-one"
      repoRoot="/repos/ledger-core"
      worktreePath="/worktrees/part-one"
      observation={{ ...observation, ...next }}
      holder={holder}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.invoke.mockResolvedValue(null);
});
afterEach(cleanup);

describe('MountBranchDecision', () => {
  it('names the mount, the recorded branch and the one found', () => {
    renderDecision();

    expect(screen.getByText('ledger-core on ak/part-one has a different branch')).toBeDefined();
    expect(
      screen.getByText(
        'ledger-core on ak/part-one was expected on ak/part-one, but Goodboy found ak/part-two. Nothing was changed.',
      ),
    ).toBeDefined();
  });

  it('adopts the observed branch on this mount', async () => {
    renderDecision();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Use this branch here' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use this branch here' }));

    await waitFor(() =>
      expect(h.store.resolveMountBranchMismatch).toHaveBeenCalledWith({
        sessionId,
        mountId,
        resolution: 'adopt-observed',
      }),
    );
  });

  it('forks a second mount when both branches are kept', async () => {
    renderDecision();

    await waitFor(() => screen.getByRole('button', { name: 'Keep both branches' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep both branches' }));

    await waitFor(() =>
      expect(h.store.resolveMountBranchMismatch).toHaveBeenCalledWith({
        sessionId,
        mountId,
        resolution: 'keep-both',
      }),
    );
  });

  it('turns off adopting a branch another mount already holds', () => {
    renderDecision({ holder: { mountId: 'mount-2' as MountId, label: 'PR #418' } });

    expect(screen.getByText('ledger-core on ak/part-one has a different branch')).toBeDefined();
    expect(
      screen.getByText(
        'ledger-core on ak/part-one was expected on ak/part-one, but Goodboy found ak/part-two. ak/part-two is already mounted as PR #418 in this session. Git keeps one branch in one worktree, so using it here would fail.',
      ),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Use this branch here' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Check this mount again' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('reads the mount again when the branch is claimed elsewhere', async () => {
    renderDecision({ holder: { mountId: 'mount-2' as MountId, label: null } });

    fireEvent.click(screen.getByRole('button', { name: 'Check this mount again' }));

    await waitFor(() =>
      expect(h.store.resolveMountBranchMismatch).toHaveBeenCalledWith({
        sessionId,
        mountId,
        resolution: 'recheck',
      }),
    );
  });

  it('puts a detached mount back on its recorded branch', async () => {
    renderDecision({ next: { state: 'detached', observedBranch: null } });

    expect(screen.getByText('ledger-core on ak/part-one is not on a branch')).toBeDefined();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Put it back on ak/part-one' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Put it back on ak/part-one' }));

    await waitFor(() =>
      expect(h.store.resolveMountBranchMismatch).toHaveBeenCalledWith({
        sessionId,
        mountId,
        resolution: 'restore-recorded',
      }),
    );
  });

  it('offers a reread when the directory could not be read', () => {
    renderDecision({ next: { state: 'unavailable', observedBranch: null } });

    expect(screen.getByText('ledger-core on ak/part-one could not be read')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Check this mount again' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('dismisses itself without resolving anything', () => {
    renderDecision();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('button', { name: 'Use this branch here' })).toBeNull();
    expect(h.store.resolveMountBranchMismatch).not.toHaveBeenCalled();
  });

  it('turns off adoption when another repository worktree holds the branch', async () => {
    h.invoke.mockResolvedValue('/worktrees/outside-this-session');
    renderDecision();

    await waitFor(() =>
      expect(
        screen.getByText(
          'ledger-core on ak/part-one was expected on ak/part-one, but Goodboy found ak/part-two. ak/part-two is already mounted in another worktree of this project. Git keeps one branch in one worktree, so using it here would fail.',
        ),
      ).toBeDefined(),
    );
    expect(
      screen.getByRole('button', { name: 'Use this branch here' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Check this mount again' }).hasAttribute('disabled'),
    ).toBe(false);
  });
});
