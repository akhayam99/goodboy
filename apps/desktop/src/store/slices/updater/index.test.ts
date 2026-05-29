// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { checkMock, relaunchMock } = vi.hoisted(() => ({
  checkMock: vi.fn(),
  relaunchMock: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({ check: checkMock }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: relaunchMock }));

import { createUpdaterSlice } from './index';
import { initialUpdaterState, type UpdaterState } from './state';

function harness() {
  let state: UpdaterState = { ...initialUpdaterState };
  const set = (p: Partial<UpdaterState> | ((s: UpdaterState) => Partial<UpdaterState>)) => {
    state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
  };
  const slice = createUpdaterSlice(set as never, (() => state) as never);
  return { slice, getState: () => state };
}

describe('updater slice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks uptodate when no update is available', async () => {
    checkMock.mockResolvedValue(null);
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    expect(getState().updaterStatus).toBe('uptodate');
    expect(getState().updateVersion).toBeNull();
  });

  it('marks available with the version when an update exists', async () => {
    checkMock.mockResolvedValue({ version: '0.2.0', downloadAndInstall: vi.fn() });
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    expect(getState().updaterStatus).toBe('available');
    expect(getState().updateVersion).toBe('0.2.0');
  });

  it('records an error when the check fails', async () => {
    checkMock.mockRejectedValue(new Error('network down'));
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    expect(getState().updaterStatus).toBe('error');
    expect(getState().updateError).toBe('network down');
  });

  it('installs and relaunches when an update is pending', async () => {
    const downloadAndInstall = vi.fn(async () => undefined);
    checkMock.mockResolvedValue({ version: '0.2.0', downloadAndInstall });
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    await slice.installUpdate();
    expect(downloadAndInstall).toHaveBeenCalled();
    expect(relaunchMock).toHaveBeenCalled();
    expect(getState().updaterStatus).toBe('downloading');
  });
});
