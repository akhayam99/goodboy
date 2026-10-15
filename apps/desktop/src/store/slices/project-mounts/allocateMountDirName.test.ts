// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { allocateMountDirName } from './allocateMountDirName';

const MID = '9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f';
const REPO = '/repos/ledger-core';
const PARENT = `${REPO}/.goodboy/worktrees`;

const sequence = (values: ReadonlyArray<number>): (() => number) => {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
};

describe('allocateMountDirName', () => {
  it('keeps the first draw when nothing holds it', async () => {
    const isTaken = vi.fn(async () => false);

    const name = await allocateMountDirName({
      mountId: MID,
      repoPath: REPO,
      parentDir: PARENT,
      random: sequence([0]),
      isTaken,
    });

    expect(name).toBe('gb-000000');
    expect(isTaken).toHaveBeenCalledTimes(1);
  });

  it('draws again when the folder already exists', async () => {
    const isTaken = vi.fn(async ({ dirName }: { dirName: string }) => dirName === 'gb-000000');

    const name = await allocateMountDirName({
      mountId: MID,
      repoPath: REPO,
      parentDir: PARENT,
      random: sequence([
        0,
        0,
        0,
        0,
        0,
        0,
        1.5 / 36,
        1.5 / 36,
        1.5 / 36,
        1.5 / 36,
        1.5 / 36,
        1.5 / 36,
      ]),
      isTaken,
    });

    expect(name).toBe('gb-111111');
    expect(isTaken.mock.calls.map(([params]) => params.dirName)).toEqual([
      'gb-000000',
      'gb-111111',
    ]);
  });

  it('falls back to a longer id after eight clashes', async () => {
    const isTaken = vi.fn(async () => true);

    const name = await allocateMountDirName({
      mountId: MID,
      repoPath: REPO,
      parentDir: PARENT,
      random: sequence([0]),
      isTaken,
    });

    expect(name).toBe('gb-000000000000');
    expect(isTaken).toHaveBeenCalledTimes(8);
  });

  it('draws the same first name the mount plan shows when nothing clashes', async () => {
    const name = await allocateMountDirName({
      mountId: MID,
      repoPath: REPO,
      parentDir: PARENT,
      isTaken: async () => false,
    });

    expect(name).toMatch(/^gb-[0-9a-z]{6}$/);
  });
});
