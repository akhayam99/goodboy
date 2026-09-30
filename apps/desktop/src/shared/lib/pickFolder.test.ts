// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dialog } = vi.hoisted(() => ({
  dialog: { open: vi.fn(async (): Promise<unknown> => null) },
}));

vi.mock('@tauri-apps/plugin-dialog', () => dialog);

import { pickFolder } from './pickFolder';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pickFolder', () => {
  it('asks for one directory and returns its path', async () => {
    dialog.open.mockResolvedValueOnce('/repos/ledger-core');

    await expect(pickFolder()).resolves.toBe('/repos/ledger-core');
    expect(dialog.open).toHaveBeenCalledWith({ directory: true, multiple: false });
  });

  it.each([null, '', ['/repos/a']])('returns null for %j', async (answer) => {
    dialog.open.mockResolvedValueOnce(answer);

    await expect(pickFolder()).resolves.toBeNull();
  });

  it('lets a refusal from the dialog reach the caller', async () => {
    dialog.open.mockRejectedValueOnce(new Error('no permission'));

    await expect(pickFolder()).rejects.toThrow('no permission');
  });
});
