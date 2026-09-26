import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { parseStyleNote } from '../replyStyle';
import { listMyReviewReplies } from '../reviewReplies';

const ok = (value: unknown): GhResult => ({
  stdout: JSON.stringify(value),
  stderr: '',
  exitCode: 0,
});

const reply = (id: number, createdAt: string) => ({
  user: { login: 'harbor-dev' },
  body: `Reply ${id}`,
  created_at: createdAt,
  in_reply_to_id: 1,
});

type Search = ReadonlyArray<{ readonly number: number; readonly updated_at: string }>;

const makeRunner = ({
  pages,
  comments,
}: {
  readonly pages: ReadonlyArray<Search>;
  readonly comments: Readonly<Record<number, ReadonlyArray<unknown>>>;
}): GhRunner => ({
  run: vi.fn(async (args: ReadonlyArray<string>) => {
    if (args[1] === 'user') {
      return ok({ login: 'harbor-dev' });
    }
    if (args.includes('search/issues')) {
      const page = Number(
        args.find((arg) => arg.startsWith('page='))?.slice('page='.length) ?? '1',
      );
      return ok({ items: pages[page - 1] ?? [] });
    }
    const number = Number(args[1]?.split('/').at(-2));
    return ok(comments[number] ?? []);
  }),
});

const searchCalls = (runner: GhRunner): number =>
  vi.mocked(runner.run).mock.calls.filter(([args]) => args.includes('search/issues')).length;

describe('listMyReviewReplies', () => {
  it('keeps only my replies to review threads, newest first, up to the limit', async () => {
    const run = vi.fn(async (args: ReadonlyArray<string>) => {
      if (args[1] === 'user') {
        return ok({ login: 'harbor-dev' });
      }
      if (args.includes('search/issues')) {
        return ok({ items: [{ number: 12 }] });
      }
      return ok([
        {
          user: { login: 'harbor-dev' },
          body: 'done in 4f21c8b',
          created_at: '2026-09-01T10:00:00Z',
          in_reply_to_id: 1,
        },
        {
          user: { login: 'harbor-dev' },
          body: 'renamed it',
          created_at: '2026-09-03T10:00:00Z',
          in_reply_to_id: 2,
        },
        {
          user: { login: 'harbor-dev' },
          body: 'opening comment',
          created_at: '2026-09-04T10:00:00Z',
          in_reply_to_id: null,
        },
        {
          user: { login: 'cascadia-lead' },
          body: 'thanks',
          created_at: '2026-09-05T10:00:00Z',
          in_reply_to_id: 3,
        },
        {
          user: { login: 'harbor-dev' },
          body: '  ',
          created_at: '2026-09-06T10:00:00Z',
          in_reply_to_id: 4,
        },
      ]);
    });
    const runner: GhRunner = { run };

    const replies = await listMyReviewReplies({
      runner,
      repoSlugs: ['acme/ledger-core'],
      limit: 1,
      opts: { workspaceId: 'workspace-1' },
    });

    expect(replies).toEqual([{ body: 'renamed it', createdAt: '2026-09-03T10:00:00Z' }]);
    expect(run).toHaveBeenCalledWith(
      [
        'api',
        '-X',
        'GET',
        'search/issues',
        '-f',
        'q=repo:acme/ledger-core type:pr commenter:harbor-dev',
        '-f',
        'sort=updated',
        '-f',
        'per_page=10',
        '-f',
        'page=1',
      ],
      { workspaceId: 'workspace-1' },
    );
    expect(run).toHaveBeenCalledWith(
      ['api', 'repos/acme/ledger-core/pulls/12/comments', '--paginate'],
      { workspaceId: 'workspace-1' },
    );
  });

  it('reads nothing more when GitHub does not name the viewer', async () => {
    const run = vi.fn(async () => ok({}));

    expect(await listMyReviewReplies({ runner: { run }, repoSlugs: ['acme/ledger-core'] })).toEqual(
      [],
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps reading older pull requests until the sample is full', async () => {
    const runner = makeRunner({
      pages: [
        [
          { number: 1, updated_at: '2026-09-20T00:00:00Z' },
          { number: 2, updated_at: '2026-09-19T00:00:00Z' },
        ],
        [
          { number: 3, updated_at: '2026-09-10T00:00:00Z' },
          { number: 4, updated_at: '2026-09-09T00:00:00Z' },
        ],
      ],
      comments: {
        1: [reply(1, '2026-09-20T00:00:00Z')],
        3: [reply(3, '2026-09-10T00:00:00Z'), reply(4, '2026-09-08T00:00:00Z')],
        4: [reply(5, '2026-09-09T00:00:00Z')],
      },
    });

    const replies = await listMyReviewReplies({
      runner,
      repoSlugs: ['acme/ledger-core'],
      limit: 3,
      pullsPerPage: 2,
    });

    expect(replies.map((entry) => entry.body)).toEqual(['Reply 1', 'Reply 3', 'Reply 5']);
    expect(searchCalls(runner)).toBe(3);
  });

  it('stops once older pull requests cannot hold a newer reply', async () => {
    const runner = makeRunner({
      pages: [
        [
          { number: 1, updated_at: '2026-09-20T00:00:00Z' },
          { number: 2, updated_at: '2026-09-01T00:00:00Z' },
        ],
        [{ number: 3, updated_at: '2026-08-01T00:00:00Z' }],
      ],
      comments: {
        1: [reply(1, '2026-09-20T00:00:00Z'), reply(2, '2026-09-18T00:00:00Z')],
        2: [reply(3, '2026-09-01T00:00:00Z')],
      },
    });

    const replies = await listMyReviewReplies({
      runner,
      repoSlugs: ['acme/ledger-core'],
      limit: 2,
      pullsPerPage: 2,
    });

    expect(replies.map((entry) => entry.body)).toEqual(['Reply 1', 'Reply 2']);
    expect(searchCalls(runner)).toBe(1);
    expect(vi.mocked(runner.run)).not.toHaveBeenCalledWith(
      ['api', 'repos/acme/ledger-core/pulls/2/comments', '--paginate'],
      {},
    );
  });
});

describe('parseStyleNote', () => {
  it('reads the note inside the marker and drops blank lines', () => {
    expect(
      parseStyleNote('noise\n<<style-note>>\nShort.\n\nStarts lowercase.\n<</style-note>>'),
    ).toBe('Short.\nStarts lowercase.');
  });

  it('gives nothing back without a complete marker', () => {
    expect(parseStyleNote('Short. Starts lowercase.')).toBeNull();
    expect(parseStyleNote('<<style-note>>Short.')).toBeNull();
    expect(parseStyleNote('<<style-note>>  <</style-note>>')).toBeNull();
  });
});
