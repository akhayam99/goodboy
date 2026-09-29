// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const { linearFetchTeamKeys } = vi.hoisted(() => ({
  linearFetchTeamKeys: vi.fn<() => Promise<ReadonlyArray<string>>>(),
}));

vi.mock('../../linear/client', () => ({ linearFetchTeamKeys }));

import { forgetTeamKeys, teamKeysOf } from './linearTeamKeys';

const WORKSPACE = 'ws-cascadia' as WorkspaceId;

beforeEach(() => {
  vi.clearAllMocks();
  forgetTeamKeys(WORKSPACE);
});

describe('teamKeysOf', () => {
  it('reuses a successful fetch', async () => {
    linearFetchTeamKeys.mockResolvedValueOnce(['CAS']);

    expect(await teamKeysOf(WORKSPACE)).toEqual(['CAS']);
    expect(await teamKeysOf(WORKSPACE)).toEqual(['CAS']);
    expect(linearFetchTeamKeys).toHaveBeenCalledTimes(1);
  });

  it('fetches again after a failed request', async () => {
    linearFetchTeamKeys.mockRejectedValueOnce(new Error('linear down'));
    linearFetchTeamKeys.mockResolvedValueOnce(['CAS']);

    expect(await teamKeysOf(WORKSPACE)).toEqual([]);
    expect(await teamKeysOf(WORKSPACE)).toEqual(['CAS']);
    expect(linearFetchTeamKeys).toHaveBeenCalledTimes(2);
  });

  it('fetches again once the connection is forgotten', async () => {
    linearFetchTeamKeys.mockResolvedValueOnce(['CAS']);
    linearFetchTeamKeys.mockResolvedValueOnce(['NW']);

    expect(await teamKeysOf(WORKSPACE)).toEqual(['CAS']);
    forgetTeamKeys(WORKSPACE);
    expect(await teamKeysOf(WORKSPACE)).toEqual(['NW']);
  });
});
