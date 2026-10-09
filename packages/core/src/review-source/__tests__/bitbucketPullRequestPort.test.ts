import { describe, expect, it } from 'vitest';
import { bitbucketPullRequestPort } from '../bitbucketPullRequestPort';
import {
  PullRequestPortError,
  PullRequestPortUnsupported,
  type PullRequestPort,
} from '../pullRequestPort';
import {
  BITBUCKET_PR_URL,
  KENJI,
  NADIA,
  OMAR,
  PRIYA,
  fakeBitbucketTransport,
  participant,
  pullRequest,
  status,
  type FakeBitbucketOptions,
} from './bitbucketPullRequestFixture';

const built = (options: FakeBitbucketOptions = {}) => {
  const { transport, calls } = fakeBitbucketTransport(options);
  const port: PullRequestPort = bitbucketPullRequestPort({ transport, prUrl: BITBUCKET_PR_URL });
  return { port, calls };
};

describe('bitbucketPullRequestPort read', () => {
  it('maps the pull request, the reviewers and the base and head branches', async () => {
    const view = await built().port.read();
    expect(view).toMatchObject({
      host: 'bitbucket',
      number: 42,
      title: 'Stop retried webhooks posting a second credit',
      body: 'Key the guard on the event id.',
      url: BITBUCKET_PR_URL,
      state: 'open',
      isDraft: false,
      baseBranch: 'main',
      headBranch: 'hl/fix-duplicate-credit',
      headSha: '6c20f48a9e1',
      mergeable: null,
      mergedAt: null,
      reviewDecision: 'changes_requested',
      resolves: [],
      mergeMethods: ['squash', 'merge', 'rebase'],
      mergeMethodReasons: {},
    });
    expect(view.author).toEqual({ login: 'nadia-p', name: 'Nadia Petrova', avatarUrl: null });
  });

  it.each([
    ['MERGED', 'merged'],
    ['DECLINED', 'closed'],
    ['SUPERSEDED', 'closed'],
  ] as const)('reads %s as %s', async (raw, expected) => {
    const view = await built({ pullRequest: pullRequest({ state: raw }) }).port.read();
    expect(view.state).toBe(expected);
  });

  it('falls back to the url it was given when the host sends no link', async () => {
    const view = await built({ pullRequest: pullRequest({ webUrl: null }) }).port.read();
    expect(view.url).toBe(BITBUCKET_PR_URL);
  });

  it('turns statuses into check rows and the files of the diff into stats', async () => {
    const view = await built().port.read();
    expect(view.checks.read).toBe('ok');
    expect(view.checks.runs.map((run) => [run.name, run.conclusion])).toEqual([
      ['unit', 'success'],
      ['lint', 'failure'],
    ]);
    expect(view.files.count).toBe(8);
    expect(view.files.first).toHaveLength(7);
    expect(view.files.first[0]).toEqual({
      path: 'src/ledger/ledgerClient.ts',
      additions: 2,
      deletions: 1,
    });
  });

  it('turns the commits into the activity pushes', async () => {
    const view = await built().port.read();
    expect(view.commits.map((commit) => [commit.sha, commit.headline, commit.author])).toEqual([
      ['6c20f48a9e1', 'Key the credit guard on the event id', 'nadia-p'],
      ['a41c9e2b7d3', 'Drop the seenEvents read', 'nadia-p'],
    ]);
  });

  it('reads without commits when only the commit list fails', async () => {
    const view = await built({ failCommits: true }).port.read();
    expect(view.commits).toEqual([]);
    expect(view.title).not.toBe('');
  });

  it('answers a denied checks read with the host text and keeps the page', async () => {
    const text = 'Your credentials lack one or more required privilege scopes.';
    const view = await built({ failStatuses: { kind: 'denied', text } }).port.read();
    expect(view.checks).toEqual({ read: 'denied', error: text, runs: [] });
    expect(view.number).toBe(42);
  });

  it('answers a failed checks read as failed, never as success', async () => {
    const view = await built({
      failStatuses: { kind: 'network', text: 'The request did not reach Bitbucket' },
    }).port.read();
    expect(view.checks.read).toBe('failed');
    expect(view.checks.runs).toEqual([]);
  });

  it('shows no checks when the host has none', async () => {
    const view = await built({ statuses: [] }).port.read();
    expect(view.checks).toEqual({ read: 'ok', error: null, runs: [] });
  });
});

describe('bitbucketPullRequestPort writes', () => {
  it('sends the title and the description as separate updates', async () => {
    const { port, calls } = built();
    await port.updateTitle({ title: 'New title' });
    await port.updateBody({ body: 'New body' });
    expect(calls.updates).toEqual([{ title: 'New title' }, { description: 'New body' }]);
  });

  it('searches the workspace members and names them by nickname', async () => {
    const { port, calls } = built();
    const people = await port.searchReviewers({ query: 'kenji' });
    expect(people).toEqual([{ login: 'kenji-w', name: 'Kenji Watanabe', avatarUrl: null }]);
    expect(calls.searches).toEqual(['kenji']);
  });

  it('keeps the current reviewers when it adds one', async () => {
    const { port, calls } = built({
      pullRequest: pullRequest({
        participants: [participant(OMAR), participant(NADIA, { role: 'PARTICIPANT' })],
      }),
    });
    await port.requestReviewers({ logins: ['priya-n', 'omar-t'] });
    expect(calls.updates).toEqual([{ reviewerUuids: [OMAR.uuid, PRIYA.uuid] }]);
  });

  it('refuses a login that is not in the workspace and changes nothing', async () => {
    const { port, calls } = built();
    const error = await port.requestReviewers({ logins: ['kenji-w', 'ghost'] }).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PullRequestPortError);
    expect((error as PullRequestPortError).message).toBe(
      'ghost is not in this Bitbucket workspace',
    );
    expect(calls.updates).toEqual([]);
  });

  it('does nothing for an empty request', async () => {
    const { port, calls } = built();
    await port.requestReviewers({ logins: ['  '] });
    expect(calls.updates).toEqual([]);
    expect(calls.searches).toEqual([]);
  });

  it.each([
    ['squash', 'squash'],
    ['merge', 'merge_commit'],
    ['rebase', 'rebase_merge'],
  ] as const)('merges with %s as the %s strategy', async (method, strategy) => {
    const { port, calls } = built();
    await port.merge({ method });
    expect(calls.merges).toEqual([strategy]);
  });

  it('declines on close', async () => {
    const { port, calls } = built();
    await port.close();
    expect(calls.declines).toBe(1);
  });

  it('has no draft and cannot reopen a declined pull request', async () => {
    const { port } = built();
    await expect(port.setDraft({ isDraft: true })).rejects.toBeInstanceOf(
      PullRequestPortUnsupported,
    );
    await expect(port.reopen()).rejects.toBeInstanceOf(PullRequestPortUnsupported);
  });

  it('keeps the host message when the merge is refused', async () => {
    const text = 'Merge strategy squash is not allowed for this repository';
    const { port } = built({ failWrites: { kind: 'failed', text } });
    const error = await port.merge({ method: 'squash' }).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect((error as PullRequestPortError).details).toBe(text);
  });

  it('reads checks as unsupported when the capability is off', async () => {
    const { transport } = fakeBitbucketTransport({ statuses: [status({ state: 'FAILED' })] });
    const port = bitbucketPullRequestPort({
      transport,
      prUrl: BITBUCKET_PR_URL,
      capabilities: {
        canReply: true,
        canResolve: false,
        canEditTitle: true,
        canEditBody: true,
        canRequestReviewers: true,
        canSetDraft: false,
        canReadChecks: false,
        canChooseMergeMethod: true,
        canClose: true,
        canReopen: false,
      },
    });
    expect((await port.read()).checks).toEqual({ read: 'unsupported', error: null, runs: [] });
  });
});
