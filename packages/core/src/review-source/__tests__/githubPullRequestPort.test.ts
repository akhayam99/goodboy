import { describe, expect, it } from 'vitest';
import { githubPullRequestPort } from '../githubPullRequestPort';
import { PullRequestPortError } from '../pullRequestPort';
import {
  GITHUB_PR_REPO,
  GITHUB_PR_URL,
  PR_VIEW_JSON,
  failure,
  githubRunner,
  jsonOk,
  type RunnerOverride,
} from './githubPullRequestFixture';

const portOf = ({
  override,
  repo = GITHUB_PR_REPO,
  prUrl = GITHUB_PR_URL,
}: {
  readonly override?: RunnerOverride;
  readonly repo?: string;
  readonly prUrl?: string | null;
} = {}) => {
  const { runner, calls } = githubRunner({ override });
  return {
    calls,
    port: githubPullRequestPort({ runner, repo, prNumber: 318, prUrl }),
  };
};

const isViewCall = (args: ReadonlyArray<string>): boolean =>
  args.join(' ').includes('closingIssuesReferences');

describe('githubPullRequestPort writes', () => {
  it('edits the title and the body with gh pr edit', async () => {
    const { port, calls } = portOf();
    await port.updateTitle({ title: 'A new title' });
    await port.updateBody({ body: 'A new body' });
    expect(calls).toEqual([
      ['pr', 'edit', '318', '--title', 'A new title'],
      ['pr', 'edit', '318', '--body', 'A new body'],
    ]);
  });

  it('requests reviewers in one call and skips an empty list', async () => {
    const { port, calls } = portOf();
    await port.requestReviewers({ logins: [' kenji-w ', '', 'omar-t'] });
    await port.requestReviewers({ logins: [' '] });
    expect(calls).toEqual([['pr', 'edit', '318', '--add-reviewer', 'kenji-w,omar-t']]);
  });

  it('marks ready and converts to a draft with gh pr ready', async () => {
    const { port, calls } = portOf();
    await port.setDraft({ isDraft: false });
    await port.setDraft({ isDraft: true });
    expect(calls).toEqual([
      ['pr', 'ready', '318'],
      ['pr', 'ready', '318', '--undo'],
    ]);
  });

  it('merges with the chosen flag', async () => {
    const { port, calls } = portOf();
    await port.merge({ method: 'squash' });
    await port.merge({ method: 'merge' });
    await port.merge({ method: 'rebase' });
    expect(calls).toEqual([
      ['pr', 'merge', '318', '--squash'],
      ['pr', 'merge', '318', '--merge'],
      ['pr', 'merge', '318', '--rebase'],
    ]);
  });

  it('closes and reopens', async () => {
    const { port, calls } = portOf();
    await port.close();
    await port.reopen();
    expect(calls).toEqual([
      ['pr', 'close', '318'],
      ['pr', 'reopen', '318'],
    ]);
  });

  it('falls back to the exit code when gh says nothing', async () => {
    const { port } = portOf({
      override: (args) => (args[1] === 'merge' ? failure({ stderr: '', exitCode: 4 }) : null),
    });
    const error = await port.merge({ method: 'squash' }).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PullRequestPortError);
    expect((error as PullRequestPortError).message).toBe('gh pr merge exited with 4');
    expect((error as PullRequestPortError).details).toBe('');
  });

  it('turns a runner that throws into a classified error', async () => {
    const port = githubPullRequestPort({
      runner: {
        run: async () => {
          throw new Error('connection refused');
        },
      },
      repo: GITHUB_PR_REPO,
      prNumber: 318,
      prUrl: GITHUB_PR_URL,
    });
    await expect(port.close()).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('githubPullRequestPort searchReviewers', () => {
  it('lists collaborators matching the query', async () => {
    const { port, calls } = portOf();
    const people = await port.searchReviewers({ query: 'O' });
    expect(people.map((person) => person.login)).toEqual(['omar-t']);
    expect(calls[0]?.[1]).toBe('repos/harborline/payments-api/collaborators?per_page=100');
  });

  it('keeps the avatar the host gives', async () => {
    const { port } = portOf();
    const people = await port.searchReviewers({ query: 'kenji' });
    expect(people).toEqual([
      { login: 'kenji-w', name: null, avatarUrl: 'https://avatars.example/kenji' },
    ]);
  });

  it('takes the repository from the pull request address when the slug is unknown', async () => {
    const { port, calls } = portOf({ repo: '' });
    await port.searchReviewers({ query: '' });
    expect(calls[0]?.[1]).toBe('repos/harborline/payments-api/collaborators?per_page=100');
  });

  it('lets gh resolve the repository when nothing names it', async () => {
    const { port, calls } = portOf({ repo: '', prUrl: null });
    await port.searchReviewers({ query: '' });
    expect(calls[0]?.[1]).toBe('repos/{owner}/{repo}/collaborators?per_page=100');
  });
});

describe('githubPullRequestPort read', () => {
  it('asks gh for the view fields, the three review reads and the merge methods', async () => {
    const { port, calls } = portOf();
    await port.read();
    const view = calls.find(isViewCall);
    expect(view?.slice(0, 5)).toEqual(['pr', 'view', '318', '--repo', GITHUB_PR_REPO]);
    expect(view?.[6]).toContain('createdAt');
    const fields = calls
      .filter((args) => args[0] === 'pr' && args[1] === 'view')
      .map((args) => args[6]);
    expect(fields).toEqual(
      expect.arrayContaining(['reviews', 'reviewRequests', 'statusCheckRollup']),
    );
    expect(calls.some((args) => args[0] === 'repo' && args[1] === 'view')).toBe(true);
  });

  it('lists the merge methods the repository allows with a reason for the others', async () => {
    const view = await portOf().port.read();
    expect(view.mergeMethods).toEqual(['squash', 'rebase']);
    expect(view.mergeMethodReasons).toEqual({ merge: 'Turned off in payments-api' });
  });

  it('offers every method when the repository settings cannot be read', async () => {
    const view = await portOf({
      override: (args) => (args[0] === 'repo' ? failure({ stderr: 'HTTP 403' }) : null),
    }).port.read();
    expect(view.mergeMethods).toEqual(['squash', 'merge', 'rebase']);
    expect(view.mergeMethodReasons).toEqual({});
  });

  it('maps the pull request fields', async () => {
    const view = await portOf().port.read();
    expect(view).toMatchObject({
      host: 'github',
      number: 318,
      state: 'open',
      isDraft: false,
      mergeable: true,
      reviewDecision: 'review_required',
      author: { login: 'nadia-p', name: 'Nadia Petrova' },
      baseBranch: 'main',
      headBranch: 'hl/fix-duplicate-credit',
      headSha: '6c20f48a9e1',
      createdAt: '2026-09-26T08:00:00Z',
    });
    expect(view.commits.map((commit) => commit.headline)).toEqual([
      'Key the credit guard on the event id',
      'Drop the seenEvents read',
    ]);
    expect(view.commits[0]?.author).toBe('nadia-p');
  });

  it('keeps the checks read apart from the review read', async () => {
    const view = await portOf({
      override: (args) =>
        args.join(' ').endsWith('--json statusCheckRollup')
          ? failure({ stderr: 'Resource not accessible by integration' })
          : null,
    }).port.read();
    expect(view.checks.read).toBe('denied');
    expect(view.checks.runs).toEqual([]);
    expect(view.reviewers).toHaveLength(3);
  });

  it('reports the failing check runs', async () => {
    const view = await portOf().port.read();
    expect(view.checks.read).toBe('ok');
    expect(view.checks.runs.map((run) => [run.name, run.conclusion])).toEqual([
      ['unit', 'success'],
      ['lint', 'failure'],
    ]);
  });

  it('reads a draft and a merged pull request', async () => {
    const draft = await portOf({
      override: (args) => (isViewCall(args) ? jsonOk({ ...PR_VIEW_JSON, isDraft: true }) : null),
    }).port.read();
    expect(draft.state).toBe('draft');
    const merged = await portOf({
      override: (args) =>
        isViewCall(args)
          ? jsonOk({ ...PR_VIEW_JSON, state: 'MERGED', mergedAt: '2026-10-07T08:00:00Z' })
          : null,
    }).port.read();
    expect(merged.state).toBe('merged');
    expect(merged.mergedAt).toBe('2026-10-07T08:00:00Z');
  });

  it('answers a classified error when the view cannot be read', async () => {
    const { port } = portOf({
      override: (args) =>
        isViewCall(args) ? failure({ stderr: 'HTTP 401: Bad credentials' }) : null,
    });
    await expect(port.read()).rejects.toMatchObject({ kind: 'denied' });
  });
});
