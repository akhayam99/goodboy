import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { createPresenceSlice } from './index';

const { focusWindow, spawnWorkspaceWindow } = vi.hoisted(() => ({
  focusWindow: vi.fn(async (_label: string): Promise<boolean> => true),
  spawnWorkspaceWindow: vi.fn(async (_id: string, _title: string): Promise<void> => undefined),
}));

vi.mock('../../../features/workspace/window', () => ({
  currentWindowLabel: () => 'main',
  focusWindow,
  spawnWorkspaceWindow,
}));

type FakeState = {
  windowPresence: Record<string, WorkspaceId | null>;
  currentWorkspaceId: WorkspaceId | null;
  setCurrentWorkspace: (id: WorkspaceId | null) => Promise<void>;
};

function harness(initial: Partial<FakeState>) {
  let state = {
    windowPresence: {},
    currentWorkspaceId: null,
    setCurrentWorkspace: vi.fn(async () => undefined),
    ...initial,
  } as FakeState;
  const set = (p: unknown) => {
    const patch = typeof p === 'function' ? (p as (s: FakeState) => Partial<FakeState>)(state) : p;
    state = { ...state, ...(patch as Partial<FakeState>) };
  };
  const get = () => state as never;
  return { slice: createPresenceSlice(set as never, get), get: () => state };
}

const wsA = 'ws-a' as WorkspaceId;
const wsB = 'ws-b' as WorkspaceId;

beforeEach(() => {
  focusWindow.mockClear();
  spawnWorkspaceWindow.mockClear();
});

describe('presence slice', () => {
  it('records and removes window presence by label', () => {
    const { slice, get } = harness({});
    slice.setWindowPresence('main', wsA);
    slice.setWindowPresence('win-1', wsB);
    expect(get().windowPresence).toEqual({ main: wsA, 'win-1': wsB });
    slice.removeWindowPresence('win-1');
    expect(get().windowPresence).toEqual({ main: wsA });
  });

  it('focuses the existing window when the workspace is already shown elsewhere', async () => {
    const { slice } = harness({ windowPresence: { 'win-1': wsB }, currentWorkspaceId: wsA });
    await slice.openWorkspace(wsB, 'B');
    expect(focusWindow).toHaveBeenCalledWith('win-1');
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
  });

  it('loads in place when the calling window has no workspace', async () => {
    const setCurrentWorkspace = vi.fn(async () => undefined);
    const { slice } = harness({ currentWorkspaceId: null, setCurrentWorkspace });
    await slice.openWorkspace(wsA, 'A');
    expect(setCurrentWorkspace).toHaveBeenCalledWith(wsA);
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
  });

  it('spawns a new window when the calling window already holds a workspace', async () => {
    const { slice } = harness({ currentWorkspaceId: wsA });
    await slice.openWorkspace(wsB, 'B');
    expect(spawnWorkspaceWindow).toHaveBeenCalledWith(wsB, 'B');
  });

  it('is a no-op when the workspace is already shown in this window', async () => {
    const { slice } = harness({ windowPresence: { main: wsA }, currentWorkspaceId: wsA });
    await slice.openWorkspace(wsA, 'A');
    expect(focusWindow).not.toHaveBeenCalled();
    expect(spawnWorkspaceWindow).not.toHaveBeenCalled();
  });
});
