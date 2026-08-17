import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Workspace, WorkspaceId, WorkspaceKind } from '@goodboy/types';

const h = vi.hoisted(() => ({
  checkoutFastForward: vi.fn(async () => ({
    branch: 'main',
    upstream: 'origin/main',
    commitsPulled: 1,
  })),
}));

vi.mock('../../../shared/lib/repo', () => ({ checkoutFastForward: h.checkoutFastForward }));

import { fastForwardWorkspaceCheckout } from './fastForwardWorkspaceCheckout';
import type { GetFn, SetFn } from './types';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const ROOT_PATH = '/tmp/acme-widgets';

type FakeState = {
  workspaces: ReadonlyArray<Workspace>;
  workspaceCheckoutPulling: Record<string, boolean>;
  loadWorkspaceGitStatus: ReturnType<typeof vi.fn>;
};

const buildWorkspace = ({ kind }: { kind: WorkspaceKind | undefined }): Workspace => ({
  id: WORKSPACE_ID,
  name: 'acme widgets',
  rootPath: ROOT_PATH,
  kind,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
});

const buildState = ({ kind }: { kind: WorkspaceKind | undefined }): FakeState => ({
  workspaces: [buildWorkspace({ kind })],
  workspaceCheckoutPulling: {},
  loadWorkspaceGitStatus: vi.fn(async () => undefined),
});

const buildPull = ({ state }: { state: FakeState }) => {
  const set = ((updater: (s: FakeState) => Partial<FakeState>) => {
    Object.assign(state, updater(state));
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return fastForwardWorkspaceCheckout(set, get);
};

const buildDeferred = () => {
  let release: () => void = () => undefined;
  const settled = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { settled, release };
};

beforeEach(() => {
  h.checkoutFastForward.mockClear();
  h.checkoutFastForward.mockImplementation(async () => ({
    branch: 'main',
    upstream: 'origin/main',
    commitsPulled: 1,
  }));
});

describe('fastForwardWorkspaceCheckout, the workspace id becomes a checkout path', () => {
  it('resolves the root path of the workspace and refreshes its git status after the pull', async () => {
    const state = buildState({ kind: 'repo' });

    await buildPull({ state })({ workspaceId: WORKSPACE_ID });

    expect(h.checkoutFastForward).toHaveBeenCalledWith({ checkoutPath: ROOT_PATH });
    expect(state.loadWorkspaceGitStatus).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID });
  });

  it('marks the checkout as pulling while the command is in flight and clears it after', async () => {
    const state = buildState({ kind: 'repo' });
    const deferred = buildDeferred();
    h.checkoutFastForward.mockImplementation(async () => {
      await deferred.settled;
      return { branch: 'main', upstream: 'origin/main', commitsPulled: 1 };
    });

    const pulling = buildPull({ state })({ workspaceId: WORKSPACE_ID });
    await Promise.resolve();

    expect(state.workspaceCheckoutPulling[WORKSPACE_ID]).toBe(true);

    deferred.release();
    await pulling;

    expect(state.workspaceCheckoutPulling[WORKSPACE_ID]).toBe(false);
  });
});

describe('fastForwardWorkspaceCheckout, the checkouts it refuses to touch', () => {
  it('no-ops silently on a composite workspace, telling the caller nothing', async () => {
    const state = buildState({ kind: 'composite' });

    await buildPull({ state })({ workspaceId: WORKSPACE_ID });

    expect(h.checkoutFastForward).not.toHaveBeenCalled();
    expect(state.loadWorkspaceGitStatus).not.toHaveBeenCalled();
    expect(state.workspaceCheckoutPulling).toEqual({});
  });

  it('no-ops silently on a simple workspace', async () => {
    const state = buildState({ kind: 'simple' });

    await buildPull({ state })({ workspaceId: WORKSPACE_ID });

    expect(h.checkoutFastForward).not.toHaveBeenCalled();
    expect(state.workspaceCheckoutPulling).toEqual({});
  });

  it('no-ops silently on a workspace whose kind was never set', async () => {
    const state = buildState({ kind: undefined });

    await buildPull({ state })({ workspaceId: WORKSPACE_ID });

    expect(h.checkoutFastForward).not.toHaveBeenCalled();
    expect(state.workspaceCheckoutPulling).toEqual({});
  });

  it('no-ops silently when the workspace id matches nothing in the store', async () => {
    const state = buildState({ kind: 'repo' });
    state.workspaces = [];

    await buildPull({ state })({ workspaceId: WORKSPACE_ID });

    expect(h.checkoutFastForward).not.toHaveBeenCalled();
    expect(state.workspaceCheckoutPulling).toEqual({});
  });
});

describe('fastForwardWorkspaceCheckout, a refused pull', () => {
  it('hands the refusal back to the caller, clears the flag and skips the status refresh', async () => {
    const state = buildState({ kind: 'repo' });
    h.checkoutFastForward.mockImplementation(async () => {
      throw new Error('this checkout has uncommitted changes. commit or stash them first');
    });

    await expect(buildPull({ state })({ workspaceId: WORKSPACE_ID })).rejects.toThrow(
      'uncommitted changes',
    );

    expect(state.workspaceCheckoutPulling[WORKSPACE_ID]).toBe(false);
    expect(state.loadWorkspaceGitStatus).not.toHaveBeenCalled();
  });
});
