// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadDetectedBrowsers } from './loadDetectedBrowsers';
import { loadDetectedEditors } from './loadDetectedEditors';
import type { GetFn, SetFn } from './types';

const run = async ({
  load,
}: {
  readonly load: (set: SetFn, get: GetFn) => () => Promise<void>;
}): Promise<unknown> => {
  const set = vi.fn<SetFn>();
  await load(set, vi.fn<GetFn>())();
  return set.mock.calls[0]?.[0];
};

describe('the detected editors and browsers loaders', () => {
  it('keeps the editors the host answered', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([{ binary: 'code', label: 'VS Code' }]);

    expect(await run({ load: loadDetectedEditors })).toEqual({
      detectedEditors: [{ binary: 'code', label: 'VS Code' }],
    });
  });

  it('stores an empty list when the host answers nothing for the editors', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    expect(await run({ load: loadDetectedEditors })).toEqual({ detectedEditors: [] });
  });

  it('stores an empty list when the editors call fails', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('no host'));

    expect(await run({ load: loadDetectedEditors })).toEqual({ detectedEditors: [] });
  });

  it('stores an empty list when the host answers nothing for the browsers', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null);

    expect(await run({ load: loadDetectedBrowsers })).toEqual({ detectedBrowsers: [] });
  });
});
