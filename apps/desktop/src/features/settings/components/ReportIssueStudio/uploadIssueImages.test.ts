import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '@goodboy/core';
import type { BugReportImage } from '../../../../store/slices/bugReportDraft/state';

type GhRunResult = { stdout: string; stderr: string; exitCode: number };

const mocks = vi.hoisted(() => ({
  invoke: vi.fn<(cmd: string, args: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

import { uploadIssueImages } from './uploadIssueImages';

const image = ({ fileName }: { readonly fileName: string }): BugReportImage => ({
  id: fileName,
  fileName,
  mimeType: 'image/png',
  sizeBytes: 4,
  dataUrl: 'data:image/png;base64,AAAA',
});

const runnerOf = (
  run: (args: ReadonlyArray<string>) => Promise<GhRunResult>,
): GhRunner & { readonly calls: Array<ReadonlyArray<string>> } => {
  const calls: Array<ReadonlyArray<string>> = [];
  return {
    calls,
    run: async (args) => {
      calls.push(args);
      return run(args);
    },
  };
};

const ok = (url: string): GhRunResult => ({ stdout: `${url}\n`, stderr: '', exitCode: 0 });

const NOW = new Date('2026-08-21T10:00:00.000Z');

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.invoke.mockImplementation(async (_command, args) => {
    const staged = (args as { readonly images: ReadonlyArray<{ readonly fileName: string }> })
      .images;
    return staged.map(({ fileName }, index) => ({
      fileName,
      payloadPath: `/tmp/goodboy-report-1/.upload/0${index + 1}-${fileName}.b64`,
    }));
  });
});

describe('uploadIssueImages', () => {
  it('puts every image into the assets repo and returns the raw urls in order', async () => {
    const runner = runnerOf(async (args) =>
      ok(`https://raw.githubusercontent.com/octocat/goodboy-issue-assets/main/${args[3]}`),
    );

    const uploaded = await uploadIssueImages({
      runner,
      slug: 'octocat/goodboy-issue-assets',
      dir: '/tmp/goodboy-report-1',
      images: [image({ fileName: 'board.png' }), image({ fileName: 'lane.png' })],
      now: NOW,
    });

    expect(uploaded?.map((entry) => entry.fileName)).toEqual(['board.png', 'lane.png']);
    expect(uploaded?.[0]?.url).toContain(
      `repos/octocat/goodboy-issue-assets/contents/reports/2026-08/${NOW.getTime()}-01-board.png`,
    );
  });

  it('reads the payload from the staged file rather than the command line', async () => {
    const runner = runnerOf(async () => ok('https://raw.githubusercontent.com/o/r/main/a.png'));

    await uploadIssueImages({
      runner,
      slug: 'octocat/goodboy-issue-assets',
      dir: '/tmp/goodboy-report-1',
      images: [image({ fileName: 'board.png' })],
      now: NOW,
    });

    expect(runner.calls[0]).toContain('content=@/tmp/goodboy-report-1/.upload/01-board.png.b64');
    expect(runner.calls[0]?.[1]).toBe('--method');
    expect(runner.calls[0]?.[2]).toBe('PUT');
  });

  it('gives up on the whole batch when one upload fails', async () => {
    const runner = runnerOf(async (args) =>
      args.some((arg) => arg.includes('02-lane'))
        ? { stdout: '', stderr: 'HTTP 403', exitCode: 1 }
        : ok('https://raw.githubusercontent.com/o/r/main/a.png'),
    );

    const uploaded = await uploadIssueImages({
      runner,
      slug: 'octocat/goodboy-issue-assets',
      dir: '/tmp/goodboy-report-1',
      images: [image({ fileName: 'board.png' }), image({ fileName: 'lane.png' })],
      now: NOW,
    });

    expect(uploaded).toBeNull();
    expect(runner.calls).toHaveLength(2);
  });

  it('gives up when the response carries no usable url', async () => {
    const runner = runnerOf(async () => ok(''));

    const uploaded = await uploadIssueImages({
      runner,
      slug: 'octocat/goodboy-issue-assets',
      dir: '/tmp/goodboy-report-1',
      images: [image({ fileName: 'board.png' })],
      now: NOW,
    });

    expect(uploaded).toBeNull();
  });

  it('gives up when the payloads cannot be staged, without calling gh', async () => {
    mocks.invoke.mockImplementation(async () => {
      throw new Error('disk is full');
    });
    const runner = runnerOf(async () => ok('https://raw.githubusercontent.com/o/r/main/a.png'));

    const uploaded = await uploadIssueImages({
      runner,
      slug: 'octocat/goodboy-issue-assets',
      dir: '/tmp/goodboy-report-1',
      images: [image({ fileName: 'board.png' })],
      now: NOW,
    });

    expect(uploaded).toBeNull();
    expect(runner.calls).toHaveLength(0);
  });
});
