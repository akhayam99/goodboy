import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { parseStyleNote } from '../replyStyle';
import { listMyReviewReplies } from '../reviewReplies';

const ok = (value: unknown) => ({ stdout: JSON.stringify(value), stderr: '', exitCode: 0 });

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
