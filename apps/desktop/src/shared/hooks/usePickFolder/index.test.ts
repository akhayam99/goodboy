// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';

const { state, dialog } = vi.hoisted(() => ({
  state: { reportError: vi.fn(async (_params: unknown) => undefined) },
  dialog: { open: vi.fn(async (): Promise<unknown> => null) },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('@tauri-apps/plugin-dialog', () => dialog);

import { usePickFolder } from './index';

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('usePickFolder', () => {
  it('returns the chosen folder without reporting anything', async () => {
    dialog.open.mockResolvedValueOnce('/repos/storefront-web');
    const { result } = renderHook(() => usePickFolder());

    await expect(result.current()).resolves.toBe('/repos/storefront-web');
    expect(state.reportError).not.toHaveBeenCalled();
  });

  it('returns null when the user cancels', async () => {
    const { result } = renderHook(() => usePickFolder());

    await expect(result.current()).resolves.toBeNull();
    expect(state.reportError).not.toHaveBeenCalled();
  });

  it('reports a refusal from the dialog and returns null', async () => {
    const error = new Error('no permission');
    dialog.open.mockRejectedValueOnce(error);
    const { result } = renderHook(() => usePickFolder());

    await expect(result.current()).resolves.toBeNull();
    expect(state.reportError).toHaveBeenCalledWith({
      title: "Couldn't open the folder picker",
      error,
    });
  });
});
