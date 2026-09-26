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
import { setPendingUpdate } from './pendingUpdate';

type HarnessOptions = {
  readonly autoDownload?: string | null;
};

function harness({ autoDownload = 'false' }: HarnessOptions = {}) {
  let state: UpdaterState = { ...initialUpdaterState };
  const set = (p: Partial<UpdaterState> | ((s: UpdaterState) => Partial<UpdaterState>)) => {
    state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
  };
  const reportError = vi.fn(async () => undefined);
  const loadSetting = vi.fn(async () => autoDownload);
  const get = (): unknown => ({
    ...state,
    reportError,
    loadSetting,
    downloadUpdate: slice.downloadUpdate,
  });
  const slice = createUpdaterSlice(set as never, get as never);
  return { slice, getState: () => state, reportError, loadSetting };
}

describe('updater slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPendingUpdate(null);
  });

  it('marks uptodate when no update is available', async () => {
    checkMock.mockResolvedValue(null);
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    expect(getState().updaterStatus).toBe('uptodate');
    expect(getState().updateVersion).toBeNull();
  });

  it('marks available with the version when an update exists, without downloading by default', async () => {
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
    expect(getState().updateFailure).toEqual({ phase: 'check', message: 'network down' });
  });

  it('keeps a known update available when a later check fails, without reporting it', async () => {
    checkMock.mockResolvedValueOnce({ version: '0.2.0', downloadAndInstall: vi.fn() });
    const { slice, getState, reportError } = harness();
    await slice.checkForUpdates();
    checkMock.mockRejectedValueOnce(new Error('offline'));
    await slice.checkForUpdates();
    expect(getState().updaterStatus).toBe('available');
    expect(getState().updateFailure?.phase).toBe('check');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('stamps the time of a successful check', async () => {
    checkMock.mockResolvedValue(null);
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    expect(getState().updateCheckedAt).not.toBeNull();
  });

  it('downloads in the background when an update is found and autoDownload is not disabled', async () => {
    const download = vi.fn(async () => undefined);
    checkMock.mockResolvedValue({ version: '0.2.0', download, body: '' });
    const { slice, getState } = harness({ autoDownload: 'true' });
    await slice.checkForUpdates();
    await vi.waitFor(() => expect(getState().updaterStatus).toBe('ready'));
    expect(download).toHaveBeenCalled();
  });

  it('does not download in the background when autoDownload is disabled', async () => {
    const download = vi.fn(async () => undefined);
    checkMock.mockResolvedValue({ version: '0.2.0', download, body: '' });
    const { slice, getState } = harness({ autoDownload: 'false' });
    await slice.checkForUpdates();
    expect(download).not.toHaveBeenCalled();
    expect(getState().updaterStatus).toBe('available');
  });

  it('downloadUpdate moves available to ready and parses the notes', async () => {
    const download = vi.fn(async () => undefined);
    checkMock.mockResolvedValue({
      version: '0.2.0',
      download,
      body: 'A short opening sentence.',
    });
    const { slice, getState } = harness({ autoDownload: 'false' });
    await slice.checkForUpdates();
    await slice.downloadUpdate();
    expect(getState().updaterStatus).toBe('ready');
    expect(getState().updateNotes?.version).toBe('0.2.0');
  });

  it('downloadUpdate falls back to available on failure', async () => {
    const download = vi.fn().mockRejectedValueOnce(new Error('connection reset'));
    checkMock.mockResolvedValue({ version: '0.2.0', download, body: '' });
    const { slice, getState } = harness({ autoDownload: 'false' });
    await slice.checkForUpdates();
    await slice.downloadUpdate();
    expect(getState().updaterStatus).toBe('available');
    expect(getState().updateFailure).toEqual({ phase: 'download', message: 'connection reset' });
  });

  it('applyUpdate installs only, without downloading again, once the update is ready', async () => {
    const download = vi.fn(async () => undefined);
    const install = vi.fn(async () => undefined);
    const downloadAndInstall = vi.fn(async () => undefined);
    checkMock.mockResolvedValue({
      version: '0.2.0',
      download,
      install,
      downloadAndInstall,
      body: '',
    });
    const { slice, getState } = harness({ autoDownload: 'false' });
    await slice.checkForUpdates();
    await slice.downloadUpdate();
    await slice.applyUpdate();
    expect(install).toHaveBeenCalledOnce();
    expect(downloadAndInstall).not.toHaveBeenCalled();
    expect(relaunchMock).toHaveBeenCalled();
    expect(getState().updaterStatus).toBe('downloading');
  });

  it('records download progress from the updater events when downloading in the foreground', async () => {
    const downloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
      onEvent({ event: 'Started', data: { contentLength: 200 } });
      onEvent({ event: 'Progress', data: { chunkLength: 50 } });
      onEvent({ event: 'Progress', data: { chunkLength: 34 } });
    });
    relaunchMock.mockImplementationOnce(() => new Promise(() => undefined));
    checkMock.mockResolvedValue({ version: '0.2.0', downloadAndInstall });
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    void slice.applyUpdate();
    await vi.waitFor(() =>
      expect(getState().updateProgress).toEqual({ downloaded: 84, total: 200 }),
    );
  });

  it('keeps the pending update and reports a retryable failure when install fails', async () => {
    const downloadAndInstall = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(undefined);
    checkMock.mockResolvedValue({ version: '0.2.0', downloadAndInstall });
    const { slice, getState, reportError } = harness();
    await slice.checkForUpdates();
    await slice.applyUpdate();
    expect(getState().updaterStatus).toBe('available');
    expect(getState().updateFailure).toEqual({ phase: 'install', message: 'connection reset' });
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't install 0.2.0",
        action: { kind: 'retry-update' },
      }),
    );
    await slice.applyUpdate();
    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(downloadAndInstall).toHaveBeenCalledTimes(2);
    expect(relaunchMock).toHaveBeenCalled();
  });

  it('lands a relaunch failure in the install failure', async () => {
    relaunchMock.mockRejectedValueOnce(new Error('relaunch refused'));
    checkMock.mockResolvedValue({
      version: '0.2.0',
      downloadAndInstall: vi.fn(async () => undefined),
    });
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    await slice.applyUpdate();
    expect(getState().updateFailure).toEqual({ phase: 'install', message: 'relaunch refused' });
  });

  it('installs and relaunches when an update is pending and not yet downloaded', async () => {
    const downloadAndInstall = vi.fn(async () => undefined);
    checkMock.mockResolvedValue({ version: '0.2.0', downloadAndInstall });
    const { slice, getState } = harness();
    await slice.checkForUpdates();
    await slice.applyUpdate();
    expect(downloadAndInstall).toHaveBeenCalled();
    expect(relaunchMock).toHaveBeenCalled();
    expect(getState().updaterStatus).toBe('downloading');
  });

  it('relaunches the app on request', async () => {
    const { slice } = harness();
    await slice.relaunchApp();
    expect(relaunchMock).toHaveBeenCalledOnce();
  });

  it('toggles the queued-until-idle flag', () => {
    const { slice, getState } = harness();
    slice.setUpdateQueuedUntilIdle({ queued: true });
    expect(getState().updateQueuedUntilIdle).toBe(true);
    slice.setUpdateQueuedUntilIdle({ queued: false });
    expect(getState().updateQueuedUntilIdle).toBe(false);
  });
});
