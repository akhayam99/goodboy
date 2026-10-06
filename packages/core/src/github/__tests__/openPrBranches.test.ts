import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { listOpenPrBranches } from '../openPrBranches';

const ok = (value: unknown) => ({ stdout: JSON.stringify(value), stderr: '', exitCode: 0 });

const raw = (overrides: Record<string, unknown>) => ({
  number: 9900,
  title: 'Skip the slot step',
  headRefName: 'grw-1348-cta-for-the-slot',
  isDraft: false,
  isCrossRepository: false,
  author: { login: 'pat-harborline' },
  ...overrides,
});

describe('listOpenPrBranches', () => {
  it('asks gh for the open pull requests of the repository', async () => {
    const run = vi.fn().mockResolvedValue(ok([]));
    const runner: GhRunner = { run };

    await listOpenPrBranches({
      runner,
      repoSlug: 'harborline/ledger-core',
      opts: { cwd: '/repos/ledger-core' },
    });

    const [args, opts] = run.mock.calls[0] ?? [];
    expect(args).toEqual(expect.arrayContaining(['pr', 'list', '--state', 'open']));
    expect(args).toEqual(expect.arrayContaining(['--repo', 'harborline/ledger-core']));
    expect(opts).toEqual({ cwd: '/repos/ledger-core' });
  });

  it('maps the head branch, number and author and drops fork branches', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(
        ok([
          raw({}),
          raw({ number: 9901, headRefName: 'from-a-fork', isCrossRepository: true }),
          raw({ number: 9902, headRefName: 'draft-work', isDraft: true, author: null }),
        ]),
      );

    const branches = await listOpenPrBranches({
      runner: { run },
      repoSlug: 'harborline/ledger-core',
    });

    expect(branches).toEqual([
      {
        number: 9900,
        title: 'Skip the slot step',
        headBranch: 'grw-1348-cta-for-the-slot',
        isDraft: false,
        author: 'pat-harborline',
      },
      {
        number: 9902,
        title: 'Skip the slot step',
        headBranch: 'draft-work',
        isDraft: true,
        author: null,
      },
    ]);
  });

  it('returns nothing when gh fails', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: '', stderr: 'not logged in', exitCode: 1 });

    const branches = await listOpenPrBranches({
      runner: { run },
      repoSlug: 'harborline/ledger-core',
    });

    expect(branches).toEqual([]);
  });
});
