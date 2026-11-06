import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAIN_WINDOW_LABEL,
  announcePresence,
  currentWindowLabel,
  focusWindow,
  handleWindowCloseRequest,
  isMainWindow,
  listenPresence,
  requestPresence,
  targetWorkspaceFromHash,
} from '../../features/workspace/window';
import {
  WINDOW_CLOSE_FALLBACK_MS,
  decideWindowClose,
  type WindowCloseDecision,
} from '../../features/workspace/decideWindowClose';
import { setWindowCloseGuard } from '../../features/workspace/windowCloseGuard';

describe('window helpers (outside a Tauri runtime)', () => {
  it('reads the target workspace from the URL hash', () => {
    globalThis.location.hash = '#ws=ws-123';
    expect(targetWorkspaceFromHash()).toBe('ws-123');
    globalThis.location.hash = '';
    expect(targetWorkspaceFromHash()).toBeNull();
  });

  it('reports the main window when no webview is present', () => {
    expect(currentWindowLabel()).toBe(MAIN_WINDOW_LABEL);
    expect(isMainWindow()).toBe(true);
  });

  it('degrades window actions to safe no-ops', async () => {
    expect(await focusWindow('win-x')).toBe(false);
    await expect(announcePresence(null)).resolves.toBeUndefined();
    await expect(requestPresence()).resolves.toBeUndefined();
  });

  it('returns a callable unlisten from listenPresence even without a runtime', async () => {
    const off = await listenPresence({
      onPresence: () => undefined,
      onRequest: () => undefined,
      onClosing: () => undefined,
    });
    expect(() => off()).not.toThrow();
  });
});

describe('closing a window', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the window open while the guard holds it for the sheet', async () => {
    const preventDefault = vi.fn();
    const guard = vi.fn(async (): Promise<WindowCloseDecision> => 'hold');
    const release = setWindowCloseGuard({ guard });

    await handleWindowCloseRequest({ event: { preventDefault } });
    release();

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(guard).toHaveBeenCalledOnce();
  });

  it('hands the guard back to plain close once its owner lets go', async () => {
    const guard = vi.fn(async (): Promise<WindowCloseDecision> => 'hold');
    const release = setWindowCloseGuard({ guard });
    release();

    await handleWindowCloseRequest({ event: { preventDefault: () => undefined } });

    expect(guard).not.toHaveBeenCalled();
  });

  it('answers with the guard when it decides in time', async () => {
    expect(await decideWindowClose({ guard: async () => 'hide' })).toBe('hide');
  });

  it('closes after the 2 second fallback when the page is too busy to answer', async () => {
    vi.useFakeTimers();
    const pending = decideWindowClose({ guard: () => new Promise(() => undefined) });

    await vi.advanceTimersByTimeAsync(WINDOW_CLOSE_FALLBACK_MS - 1);
    const early = await Promise.race([pending, Promise.resolve('still waiting')]);
    await vi.advanceTimersByTimeAsync(1);

    expect(early).toBe('still waiting');
    expect(await pending).toBe('close');
  });

  it('closes when the guard fails', async () => {
    expect(
      await decideWindowClose({
        guard: async () => {
          throw new Error('store busy');
        },
      }),
    ).toBe('close');
  });
});
