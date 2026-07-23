import { describe, expect, it, vi } from 'vitest';
import type { GhResult, GhRunner } from '../gh';
import { GhCliError } from '../gh';
import { addPullRequestReview, fetchPrNodeId, type ReviewThreadDraft } from '../reviews';

function jsonOk(data: unknown): GhResult {
  return { stdout: JSON.stringify(data), stderr: '', exitCode: 0 };
}

function makeRunner(result: GhResult): GhRunner {
  return { run: vi.fn(async () => result) };
}

function runnerArgs(runner: GhRunner): ReadonlyArray<string> {
  return (runner.run as ReturnType<typeof vi.fn>).mock.calls[0]![0] as ReadonlyArray<string>;
}

const thread: ReviewThreadDraft = {
  path: 'src/a.ts',
  line: 12,
  side: 'RIGHT',
  startLine: null,
  startSide: null,
  body: 'guard the null case',
};

describe('fetchPrNodeId', () => {
  it('returns the PR node id', async () => {
    const runner = makeRunner(jsonOk({ id: 'PR_kwABC' }));
    expect(await fetchPrNodeId(runner, 'acme/web', 42)).toBe('PR_kwABC');
    expect(runner.run).toHaveBeenCalledWith(
      ['pr', 'view', '42', '--repo', 'acme/web', '--json', 'id'],
      expect.any(Object),
    );
  });

  it('throws GhCliError when the id is missing', async () => {
    const runner = makeRunner(jsonOk({}));
    await expect(fetchPrNodeId(runner, 'acme/web', 42)).rejects.toBeInstanceOf(GhCliError);
  });
});

describe('addPullRequestReview', () => {
  const okResponse = jsonOk({
    data: {
      addPullRequestReview: {
        pullRequestReview: { id: 'PRR_1', url: 'https://github.com/acme/web/pull/42#prr-1' },
      },
    },
  });

  it('returns the posted review id + url on success', async () => {
    const runner = makeRunner(okResponse);
    const result = await addPullRequestReview(runner, {
      pullRequestId: 'PR_kwABC',
      event: 'COMMENT',
      body: 'overall pass',
      threads: [thread],
    });
    expect(result).toEqual({ id: 'PRR_1', url: 'https://github.com/acme/web/pull/42#prr-1' });
  });

  it('inlines every thread with escaped path and body into the mutation', async () => {
    const runner = makeRunner(okResponse);
    await addPullRequestReview(runner, {
      pullRequestId: 'PR_kwABC',
      event: 'COMMENT',
      body: '',
      threads: [
        thread,
        { path: 'src/b.ts', line: 9, side: 'LEFT', startLine: 5, startSide: null, body: 'a "b"' },
      ],
    });
    const query = runnerArgs(runner).find((arg) => arg.startsWith('query='));
    expect(query).toContain('{path:"src/a.ts",line:12,side:RIGHT,body:"guard the null case"}');
    expect(query).toContain(
      '{path:"src/b.ts",line:9,side:LEFT,startLine:5,startSide:LEFT,body:"a \\"b\\""}',
    );
  });

  it('maps the event and passes id + body as graphql variables', async () => {
    const runner = makeRunner(okResponse);
    await addPullRequestReview(runner, {
      pullRequestId: 'PR_kwABC',
      event: 'REQUEST_CHANGES',
      body: 'needs work',
      threads: [],
    });
    const args = runnerArgs(runner);
    expect(args).toContain('pullRequestId=PR_kwABC');
    expect(args).toContain('body=needs work');
    const query = args.find((arg) => arg.startsWith('query='));
    expect(query).toContain('event:REQUEST_CHANGES');
    expect(query).toContain('threads:[]');
  });

  it('throws GhCliError when graphql returns errors', async () => {
    const runner = makeRunner(jsonOk({ errors: [{ message: 'not permitted' }] }));
    await expect(
      addPullRequestReview(runner, {
        pullRequestId: 'PR_x',
        event: 'APPROVE',
        body: '',
        threads: [],
      }),
    ).rejects.toBeInstanceOf(GhCliError);
  });

  it('throws GhCliError when the response is missing the review payload', async () => {
    const runner = makeRunner(jsonOk({ data: { addPullRequestReview: null } }));
    await expect(
      addPullRequestReview(runner, {
        pullRequestId: 'PR_x',
        event: 'COMMENT',
        body: '',
        threads: [],
      }),
    ).rejects.toBeInstanceOf(GhCliError);
  });
});
