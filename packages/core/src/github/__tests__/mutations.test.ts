import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { GhCliError } from '../gh';
import { addReviewThreadReply, resolveReviewThread, updateReviewComment } from '../mutations';

function jsonOk(data: unknown): GhResult {
  return { stdout: JSON.stringify(data), stderr: '', exitCode: 0 };
}

function makeRunner(result: GhResult): GhRunner {
  return { run: vi.fn(async () => result) };
}

describe('resolveReviewThread', () => {
  it('returns the post-mutation thread state on success', async () => {
    const runner = makeRunner(
      jsonOk({
        data: {
          resolveReviewThread: {
            thread: { id: 'PRT_1', isResolved: true },
          },
        },
      }),
    );
    const result = await resolveReviewThread(runner, 'PRT_1');
    expect(result).toEqual({ id: 'PRT_1', isResolved: true });
  });

  it('passes the threadId to the gh cli as a graphql variable', async () => {
    const runner = makeRunner(
      jsonOk({
        data: { resolveReviewThread: { thread: { id: 'PRT_42', isResolved: true } } },
      }),
    );
    await resolveReviewThread(runner, 'PRT_42');
    expect(runner.run).toHaveBeenCalledWith(
      expect.arrayContaining(['api', 'graphql', '-F', 'threadId=PRT_42']),
      expect.any(Object),
    );
  });

  it('throws GhCliError when graphql returns errors', async () => {
    const runner = makeRunner(
      jsonOk({
        errors: [{ message: 'Could not resolve to a node with the global id of PRT_x.' }],
      }),
    );
    await expect(resolveReviewThread(runner, 'PRT_x')).rejects.toBeInstanceOf(GhCliError);
  });

  it('throws GhCliError when the response is missing the thread payload', async () => {
    const runner = makeRunner(jsonOk({ data: { resolveReviewThread: { thread: null } } }));
    await expect(resolveReviewThread(runner, 'PRT_1')).rejects.toBeInstanceOf(GhCliError);
  });
});

describe('addReviewThreadReply', () => {
  it('returns the new comment id + url on success', async () => {
    const runner = makeRunner(
      jsonOk({
        data: {
          addPullRequestReviewThreadReply: {
            comment: { id: 'PRRC_42', url: 'https://github.com/o/r/pull/9#disc_42' },
          },
        },
      }),
    );
    const result = await addReviewThreadReply(runner, 'PRT_1', 'Resolved in `abc1234`');
    expect(result).toEqual({ id: 'PRRC_42', url: 'https://github.com/o/r/pull/9#disc_42' });
  });

  it('passes the threadId and body as graphql variables', async () => {
    const runner = makeRunner(
      jsonOk({
        data: {
          addPullRequestReviewThreadReply: { comment: { id: 'PRRC_1', url: 'u' } },
        },
      }),
    );
    await addReviewThreadReply(runner, 'PRT_99', 'multi\nline body');
    expect(runner.run).toHaveBeenCalledWith(
      expect.arrayContaining(['api', 'graphql', '-F', 'threadId=PRT_99']),
      expect.any(Object),
    );
    const args = (runner.run as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as ReadonlyArray<string>;
    expect(args).toContain('body=multi\nline body');
  });

  it('keeps one body per thread across several threads', async () => {
    const runner = makeRunner(
      jsonOk({
        data: {
          addPullRequestReviewThreadReply: { comment: { id: 'PRRC_1', url: 'u' } },
        },
      }),
    );
    await addReviewThreadReply(runner, 'PRRT_1', 'answer for one');
    await addReviewThreadReply(runner, 'PRRT_2', 'answer for two');
    const calls = (runner.run as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as ReadonlyArray<string>,
    );
    expect(calls[0]).toEqual(expect.arrayContaining(['-F', 'threadId=PRRT_1']));
    expect(calls[0]).toContain('body=answer for one');
    expect(calls[1]).toEqual(expect.arrayContaining(['-F', 'threadId=PRRT_2']));
    expect(calls[1]).toContain('body=answer for two');
  });

  it('throws GhCliError when graphql returns errors', async () => {
    const runner = makeRunner(jsonOk({ errors: [{ message: 'thread not found' }] }));
    await expect(addReviewThreadReply(runner, 'PRT_x', 'hi')).rejects.toBeInstanceOf(GhCliError);
  });

  it('throws GhCliError when the response is missing the comment payload', async () => {
    const runner = makeRunner(
      jsonOk({ data: { addPullRequestReviewThreadReply: { comment: null } } }),
    );
    await expect(addReviewThreadReply(runner, 'PRT_1', 'hi')).rejects.toBeInstanceOf(GhCliError);
  });
});

describe('updateReviewComment', () => {
  it('returns the edited comment id and url', async () => {
    const runner = makeRunner(
      jsonOk({
        data: {
          updatePullRequestReviewComment: {
            pullRequestReviewComment: { id: 'PRRC_42', url: 'https://github.com/o/r/pull/9#r42' },
          },
        },
      }),
    );
    const result = await updateReviewComment(runner, 'PRRC_42', 'Fixed in `e31b9f4`.');
    expect(result).toEqual({ id: 'PRRC_42', url: 'https://github.com/o/r/pull/9#r42' });
  });

  it('passes the comment id and the whole new body as graphql variables', async () => {
    const runner = makeRunner(
      jsonOk({
        data: {
          updatePullRequestReviewComment: { pullRequestReviewComment: { id: 'PRRC_1', url: 'u' } },
        },
      }),
    );
    await updateReviewComment(runner, 'PRRC_1', 'line one\n\nUpdate: c81e5aa was squashed.');
    const args = (runner.run as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as ReadonlyArray<string>;
    expect(args).toEqual(expect.arrayContaining(['api', 'graphql', '-F', 'commentId=PRRC_1']));
    expect(args.join(' ')).toContain('updatePullRequestReviewComment');
    expect(args).toContain('body=line one\n\nUpdate: c81e5aa was squashed.');
  });

  it('throws GhCliError on graphql errors and on a missing payload', async () => {
    await expect(
      updateReviewComment(makeRunner(jsonOk({ errors: [{ message: 'denied' }] })), 'PRRC_1', 'x'),
    ).rejects.toBeInstanceOf(GhCliError);
    await expect(
      updateReviewComment(
        makeRunner(jsonOk({ data: { updatePullRequestReviewComment: null } })),
        'PRRC_1',
        'x',
      ),
    ).rejects.toBeInstanceOf(GhCliError);
  });
});
