import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { GhCliError } from '../gh';
import { resolveReviewThread } from '../mutations';

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
